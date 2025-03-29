#include "solver.h"

void Solver::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env,
                  "Solver",
                  {InstanceMethod("setOption", &Solver::SetOption),
                   InstanceMethod("getOption", &Solver::GetOption),

                   InstanceMethod("passModel", &Solver::PassModel),
                   InstanceMethod("readModel", &Solver::ReadModel),
                   InstanceMethod("writeModel", &Solver::WriteModel),

                   InstanceMethod("changeObjectiveSense", &Solver::ChangeObjectiveSense),
                   InstanceMethod("changeObjectiveOffset", &Solver::ChangeObjectiveOffset),
                   InstanceMethod("changeColsCost", &Solver::ChangeColsCost),
                   InstanceMethod("addRows", &Solver::AddRows),

                   InstanceMethod("run", &Solver::Run),
                   InstanceMethod("getModelStatus", &Solver::GetModelStatus),
                   InstanceMethod("getInfo", &Solver::GetInfo),

                   InstanceMethod("getSolution", &Solver::GetSolution),
                   InstanceMethod("setSolution", &Solver::SetSolution),
                   InstanceMethod("writeSolution", &Solver::WriteSolution),
                   InstanceMethod("assessPrimalSolution", &Solver::AssessPrimalSolution),

                   InstanceMethod("clearModel", &Solver::ClearModel),
                   InstanceMethod("clearSolver", &Solver::ClearSolver),
                   InstanceMethod("clear", &Solver::Clear)});

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("Solver", func);
}

Solver::Solver(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<Solver>(info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return;
  }
  this->highs_ = std::make_shared<Highs>();
}

// Options

void Solver::SetOption(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 2 || !info[0].IsString()) {
    ThrowTypeError(env, "Expected 2 arguments [string, boolean | number | string]");
    return;
  }
  Napi::String name = info[0].As<Napi::String>();
  Napi::Value val = info[1];
  HighsStatus status = HighsStatus::kError;
  if (val.IsBoolean()) {
    status = this->highs_->setOptionValue(name, val.As<Napi::Boolean>().Value());
  } else if (val.IsString()) {
    status = this->highs_->setOptionValue(name, val.As<Napi::String>().Utf8Value());
  } else {
    Napi::Number num = val.As<Napi::Number>();
    double d = num.DoubleValue();
    if (trunc(d) == d && std::isfinite(d)) {
      status = this->highs_->setOptionValue(name, num.Int32Value());
    }
    if (status == HighsStatus::kError) {
      status = this->highs_->setOptionValue(name, d);
    }
  }
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Setting option failed");
    return;
  }
}

Napi::Value Solver::GetOption(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsString()) {
    ThrowTypeError(env, "Expected 1 argument [string]");
    return env.Undefined();
  }
  std::string name = info[0].As<Napi::String>().Utf8Value();
  HighsStatus status = HighsStatus::kError;
  HighsOptionType type;
  if ((this->highs_->getOptionType(name, type)) != HighsStatus::kOk) {
    ThrowError(env, "Getting option type failed");
    return env.Undefined();
  }
  Napi::Value val = env.Undefined();
  switch (type) {
    case HighsOptionType::kBool: {
      bool prim = false;
      if ((status = this->highs_->getOptionValue(name, prim)) == HighsStatus::kOk) {
        val = Napi::Boolean::New(env, prim);
      }
      break;
    }
    case HighsOptionType::kDouble: {
      double prim = false;
      if ((status = this->highs_->getOptionValue(name, prim)) == HighsStatus::kOk) {
        val = Napi::Number::New(env, prim);
      }
      break;
    }
    case HighsOptionType::kInt: {
      HighsInt prim = false;
      if ((status = this->highs_->getOptionValue(name, prim)) == HighsStatus::kOk) {
        val = Napi::Number::New(env, prim);
      }
      break;
    }
    case HighsOptionType::kString: {
      std::string prim = "";
      if ((status = this->highs_->getOptionValue(name, prim)) == HighsStatus::kOk) {
        val = Napi::String::New(env, prim);
      }
      break;
    }
  }
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Getting option value failed");
    return env.Undefined();
  }
  return val;
}

// Model

/** Generic async solver update worker. */
class UpdateWorker : public Napi::AsyncWorker {
 public:
  UpdateWorker(Napi::Function& cb, std::shared_ptr<Highs> highs, std::string name)
  : Napi::AsyncWorker(cb), highs_(highs), name_(name) {}

  virtual HighsStatus Update(Highs& highs) = 0;

  void Execute() override {
    HighsStatus status = this->Update(*this->highs_);
    if (status != HighsStatus::kOk) {
      SetError(this->name_ + " failed");
    }
  }

  void OnOK() override {
    Napi::HandleScope scope(Env());
    Callback().Call({Env().Null()});
  }

 private:
  std::shared_ptr<Highs> highs_;
  std::string name_;
};

ObjSense ToObjSense(const Napi::Value& val) {
  bool b = val.As<Napi::Boolean>().Value();
  return b ? ObjSense::kMaximize : ObjSense::kMinimize;
}

void Solver::PassModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsObject()) {
    ThrowTypeError(env, "Expected 1 argument [object]");
    return;
  }
  Napi::Object obj = info[0].As<Napi::Object>();

  Napi::Value matrixVal = obj.Get("weights");
  if (!matrixVal.IsObject()) {
    ThrowTypeError(env, "Invalid matrix");
    return;
  }
  Napi::Object matrixObj = matrixVal.As<Napi::Object>();
  Napi::Int32Array matrixOffsets = matrixObj.Get("offsets").As<Napi::Int32Array>();
  Napi::Float64Array matrixVals = matrixObj.Get("values").As<Napi::Float64Array>();

  Napi::Value hessianVal = obj.Get("objectiveHessian");
  HighsInt hessianNonZeroCount = 0;
  HighsInt *hessianOffsets = nullptr;
  HighsInt *hessianIndices = nullptr;
  double *hessianValues = nullptr;
  if (!hessianVal.IsUndefined()) {
    if (!hessianVal.IsObject()) {
      ThrowTypeError(env, "Invalid objective hessian");
      return;
    }
    Napi::Object hessianObj = hessianVal.As<Napi::Object>();
    Napi::Float64Array vals = hessianObj.Get("values").As<Napi::Float64Array>();
    hessianNonZeroCount = vals.ElementLength();
    hessianOffsets = hessianObj.Get("offsets").As<Napi::Int32Array>().Data();
    hessianIndices = hessianObj.Get("indices").As<Napi::Int32Array>().Data();
    hessianValues = vals.Data();
  }

  Napi::Value offsetVal = obj.Get("objectiveOffset");
  Napi::Value typesVal = obj.Get("columnTypes");

  HighsStatus status = this->highs_->passModel(
    obj.Get("columnCount").As<Napi::Number>().Int64Value(),
    obj.Get("rowCount").As<Napi::Number>().Int64Value(),
    matrixVals.ElementLength(),
    hessianNonZeroCount,
    (HighsInt) MatrixFormat::kRowwise,
    (HighsInt) HessianFormat::kTriangular,
    (HighsInt) ToObjSense(obj.Get("isMaximization")),
    offsetVal.IsUndefined() ? 0 : offsetVal.As<Napi::Number>().DoubleValue(),
    obj.Get("objectiveLinearWeights").As<Napi::Float64Array>().Data(),
    obj.Get("columnLowerBounds").As<Napi::Float64Array>().Data(),
    obj.Get("columnUpperBounds").As<Napi::Float64Array>().Data(),
    obj.Get("rowLowerBounds").As<Napi::Float64Array>().Data(),
    obj.Get("rowUpperBounds").As<Napi::Float64Array>().Data(),
    matrixOffsets.Data(),
    matrixObj.Get("indices").As<Napi::Int32Array>().Data(),
    matrixVals.Data(),
    hessianOffsets,
    hessianIndices,
    hessianValues,
    typesVal.IsUndefined() ? nullptr : typesVal.As<Napi::Int32Array>().Data()
  );
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Pass model failed");
    return;
  }
}

class ReadModelWorker : public UpdateWorker {
 public:
  ReadModelWorker(Napi::Function& cb, std::shared_ptr<Highs> highs, std::string path)
  : UpdateWorker(cb, highs, "Read model"), path_(path) {}

  HighsStatus Update(Highs& highs) override {
    return highs.readModel(this->path_);
  }

 private:
  std::string path_;
};

void Solver::ReadModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 2 || !info[0].IsString() ||!info[1].IsFunction()) {
    ThrowTypeError(env, "Expected 2 arguments [string, function]");
    return;
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();
  Napi::Function cb = info[1].As<Napi::Function>();
  ReadModelWorker* worker = new ReadModelWorker(cb, this->highs_, path);
  worker->Queue();
}

class WriteModelWorker : public UpdateWorker {
 public:
  WriteModelWorker(Napi::Function& cb, std::shared_ptr<Highs> highs, std::string path)
  : UpdateWorker(cb, highs, "Write model"), path_(path) {}

  HighsStatus Update(Highs& highs) override {
    return highs.writeModel(this->path_);
  }

 private:
  std::string path_;
};

void Solver::WriteModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 2 || !info[0].IsString() || !info[1].IsFunction()) {
    ThrowTypeError(env, "Expected 2 arguments [string, function]");
    return;
  }

  std::string path = info[0].As<Napi::String>().Utf8Value();
  Napi::Function cb = info[1].As<Napi::Function>();
  WriteModelWorker* worker = new WriteModelWorker(cb, this->highs_, path);
  worker->Queue();
}

// Updates

void Solver::ChangeObjectiveSense(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsBoolean()) {
    ThrowTypeError(env, "Expected 1 argument [boolean]");
    return;
  }

  ObjSense sense = ToObjSense(info[0].As<Napi::Boolean>());
  HighsStatus status = this->highs_->changeObjectiveSense(sense);
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Change objective sense failed");
    return;
  }
}

void Solver::ChangeObjectiveOffset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsNumber()) {
    ThrowTypeError(env, "Expected 1 argument [number]");
    return;
  }

  double offset = info[0].As<Napi::Number>().DoubleValue();
  HighsStatus status = this->highs_->changeObjectiveOffset(offset);
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Change objective offset failed");
    return;
  }
}

void Solver::ChangeColsCost(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsTypedArray()) {
    ThrowTypeError(env, "Expected 1 argument [Float64Array]");
    return;
  }

  Napi::Float64Array arr = info[0].As<Napi::Float64Array>();
  std::vector<HighsInt> mask(arr.ElementLength(), 1);
  HighsStatus status = this->highs_->changeColsCost(&mask[0], arr.Data());
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Change columns cost failed");
    return;
  }
}

void Solver::AddRows(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (
    length != 4 ||
    !info[0].IsNumber() ||
    !info[1].IsTypedArray() ||
    !info[2].IsTypedArray() ||
    !info[3].IsObject()
  ) {
    ThrowTypeError(env, "Expected 4 arguments [number, Float64Array, Float64Array, object]");
    return;
  }

  double height = info[0].As<Napi::Number>().DoubleValue();
  Napi::Float64Array lbs = info[1].As<Napi::Float64Array>();
  Napi::Float64Array ubs = info[2].As<Napi::Float64Array>();
  Napi::Object weights = info[3].As<Napi::Object>();
  Napi::Float64Array vals = weights.Get("values").As<Napi::Float64Array>();

  HighsStatus status = this->highs_->addRows(
    height,
    lbs.Data(),
    ubs.Data(),
    vals.ElementLength(),
    weights.Get("offsets").As<Napi::Int32Array>().Data(),
    weights.Get("indices").As<Napi::Int32Array>().Data(),
    vals.Data()
  );
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Adding rows failed");
    return;
  }
}

// Running

class RunWorker : public UpdateWorker {
 public:
  RunWorker(Napi::Function& cb, std::shared_ptr<Highs> highs)
  : UpdateWorker(cb, highs, "Run") {}

  HighsStatus Update(Highs& highs) override {
    return highs.run();
  }
};

void Solver::Run(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsFunction()) {
    ThrowTypeError(env, "Expected 1 argument [function]");
    return;
  }
  Napi::Function cb = info[0].As<Napi::Function>();
  RunWorker* worker = new RunWorker(cb, this->highs_);
  worker->Queue();
}

Napi::Value Solver::GetModelStatus(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return env.Undefined();
  }
  return Napi::Number::New(env, (int) this->highs_->getModelStatus());
}

Napi::Value Solver::GetInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return env.Undefined();
  }
  Napi::Object obj = Napi::Object::New(env);
  HighsInfo data = this->highs_->getInfo();
  for (auto & grec : data.records) {
    Napi::Value val = env.Undefined();
    if (auto* srec = dynamic_cast<InfoRecordInt64*>(grec)) {
      val = Napi::Number::New(env, srec->value == nullptr ? srec->default_value : *srec->value);
    } else if (auto* srec = dynamic_cast<InfoRecordInt*>(grec)) {
      val = Napi::Number::New(env, srec->value == nullptr ? srec->default_value : *srec->value);
    } else if (auto* srec = dynamic_cast<InfoRecordDouble*>(grec)) {
      val = Napi::Number::New(env, srec->value == nullptr ? srec->default_value : *srec->value);
    }
    if (!val.IsUndefined()) {
      obj.Set(grec->name, val);
    }
  }
  return obj;
}

// Callbacks

void Solver::SetCallback(const Napi::CallbackInfo& info) {
  // TODO. Need to figure out how best to call JS from worker.
}

int ToCallbackType(const Napi::Env& env, const Napi::Value& val) {
  int tp = val.As<Napi::Number>().Int32Value();
  if (tp < 0 || tp > HighsCallbackType::kNumCallbackType) {
    ThrowError(env, "Unexpected callback type");
    return -1;
  }
  return tp;
}

void Solver::StartCallback(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsNumber()) {
    ThrowTypeError(env, "Expected 1 argument [number]");
    return;
  }
  int tp = ToCallbackType(env, info[0]);
  if (tp < 0) {
    return;
  }
  this->highs_->startCallback(tp);
}

void Solver::StopCallback(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsNumber()) {
    ThrowTypeError(env, "Expected 1 argument [number]");
    return;
  }
  int tp = ToCallbackType(env, info[0]);
  if (tp < 0) {
    return;
  }
  this->highs_->stopCallback(tp);
}

// Solutions

Napi::Value ToFloat64Array(const Napi::Env& env, const std::vector<double>& vec) {
  Napi::Float64Array arr = Napi::Float64Array::New(env, vec.size());
  std::copy(vec.begin(), vec.end(), arr.Data());
  return arr;
}

Napi::Value Solver::GetSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return env.Undefined();
  }
  Napi::Object obj = Napi::Object::New(env);
  const HighsSolution& sol = this->highs_->getSolution();
  obj.Set("isValueValid", sol.value_valid);
  obj.Set("isDualValid", sol.dual_valid);
  obj.Set("columnValues", ToFloat64Array(env, sol.col_value));
  obj.Set("columnDualValues", ToFloat64Array(env, sol.col_dual));
  obj.Set("rowValues", ToFloat64Array(env, sol.row_value));
  obj.Set("rowDualValues", ToFloat64Array(env, sol.row_dual));
  return obj;
}

void Solver::SetSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsObject()) {
    ThrowTypeError(env, "Expected 1 argument [object]");
    return;
  }
  Napi::Object obj = info[0].As<Napi::Object>();

  HighsSolution sol;
  AssignToVector(sol.col_value, obj.Get("columnValues"));
  AssignToVector(sol.col_dual, obj.Get("columnDualValues"));
  AssignToVector(sol.row_value, obj.Get("rowValues"));
  AssignToVector(sol.row_dual, obj.Get("rowDualValues"));

  HighsStatus status = this->highs_->setSolution(sol);
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Set solution failed");
    return;
  }
}

Napi::Value Solver::AssessPrimalSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return env.Undefined();
  }

  bool valid, integral, feasible;
  Napi::Object obj = Napi::Object::New(env);
  HighsStatus status = this->highs_->assessPrimalSolution(valid, integral, feasible);
  bool ok = status == HighsStatus::kOk;
  obj.Set("isValid", ok && valid);
  obj.Set("isIntegral", ok && integral);
  obj.Set("isFeasible", ok && feasible);
  return obj;
}

class WriteSolutionWorker : public UpdateWorker {
 public:
  WriteSolutionWorker(Napi::Function& cb, std::shared_ptr<Highs> highs, std::string path, SolutionStyle style)
  : UpdateWorker(cb, highs, "Write solution"), path_(path), style_(style) {}

  HighsStatus Update(Highs& highs) override {
    return highs.writeSolution(this->path_, this->style_);
  }

 private:
  std::string path_;
  SolutionStyle style_;
};

void Solver::WriteSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsFunction()) {
    ThrowTypeError(env, "Expected 3 arguments [string, number, function]");
    return;
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();
  int style = info[1].As<Napi::Number>().Int32Value();
  if (style < 0 || style > SolutionStyle::kSolutionStyleMax) {
    ThrowError(env, "Unexpected style");
    return;
  }
  Napi::Function cb = info[2].As<Napi::Function>();
  WriteSolutionWorker* worker = new WriteSolutionWorker(cb, this->highs_, path, (SolutionStyle) style);
  worker->Queue();
}

// Reset

void Solver::Clear(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return;
  }
  HighsStatus status = this->highs_->clear();
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Clear failed");
    return;
  }
}

void Solver::ClearModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return;
  }
  HighsStatus status = this->highs_->clearModel();
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Clear model failed");
    return;
  }
}

void Solver::ClearSolver(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    ThrowTypeError(env, "Expected 0 arguments");
    return;
  }
  HighsStatus status = this->highs_->clearSolver();
  if (status != HighsStatus::kOk) {
    ThrowError(env, "Clear solver failed");
    return;
  }
}
