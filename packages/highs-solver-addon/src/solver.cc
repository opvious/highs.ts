#include "solver.h"

void Solver::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env,
                  "Solver",
                  {InstanceMethod("setOption", &Solver::SetOption),
                   InstanceMethod("getOption", &Solver::GetOption),
                   InstanceMethod("passModel", &Solver::PassModel),
                   InstanceMethod("readModel", &Solver::ReadModel),
                   InstanceMethod("run", &Solver::Run),
                   InstanceMethod("getModelStatus", &Solver::GetModelStatus),
                   InstanceMethod("getInfo", &Solver::GetInfo),
                   InstanceMethod("getSolution", &Solver::GetSolution),
                   InstanceMethod("writeSolution", &Solver::WriteSolution),
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

MatrixFormat ToMatrixFormat(const Napi::Value& val) {
  bool b = val.As<Napi::Boolean>().Value();
  return b ? MatrixFormat::kColwise : MatrixFormat::kRowwise;
}

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

  Napi::Value matrixVal = obj.Get("matrix");
  if (!matrixVal.IsObject()) {
    ThrowTypeError(env, "Invalid matrix");
    return;
  }
  Napi::Object matrixObj = matrixVal.As<Napi::Object>();
  Napi::Int32Array matrixStarts = matrixObj.Get("starts").As<Napi::Int32Array>();
  Napi::Float64Array matrixVals = matrixObj.Get("values").As<Napi::Float64Array>();

  Napi::Value hessianVal = obj.Get("hessian");
  HighsInt hessianNonZeroCount = 0;
  HighsInt *hessianStarts = nullptr;
  HighsInt *hessianIndices = nullptr;
  double *hessianValues = nullptr;
  if (!hessianVal.IsUndefined()) {
    if (!hessianVal.IsObject()) {
      ThrowTypeError(env, "Invalid hessian");
      return;
    }
    Napi::Object hessianObj = hessianVal.As<Napi::Object>();
    if (ToMatrixFormat(hessianObj.Get("isColumnOriented")) != MatrixFormat::kColwise) {
      ThrowTypeError(env, "Hessian must be column oriented");
      return;
    }
    Napi::Float64Array vals = hessianObj.Get("values").As<Napi::Float64Array>();
    hessianNonZeroCount = vals.ElementLength();
    hessianStarts = hessianObj.Get("starts").As<Napi::Int32Array>().Data();
    hessianIndices = hessianObj.Get("indices").As<Napi::Int32Array>().Data();
    hessianValues = vals.Data();
  }

  HighsStatus status = this->highs_->passModel(
    obj.Get("columnCount").As<Napi::Number>().Int64Value(),
    obj.Get("rowCount").As<Napi::Number>().Int64Value(),
    matrixVals.ElementLength(),
    hessianNonZeroCount,
    (HighsInt) ToMatrixFormat(matrixObj.Get("isColumnOriented")),
    (HighsInt) HessianFormat::kTriangular,
    (HighsInt) ToObjSense(obj.Get("isMaximization")),
    obj.Get("offset").As<Napi::Number>().DoubleValue(),
    obj.Get("costs").As<Napi::Float64Array>().Data(),
    obj.Get("columnLowerBounds").As<Napi::Float64Array>().Data(),
    obj.Get("columnUpperBounds").As<Napi::Float64Array>().Data(),
    obj.Get("rowLowerBounds").As<Napi::Float64Array>().Data(),
    obj.Get("rowUpperBounds").As<Napi::Float64Array>().Data(),
    matrixStarts.Data(),
    matrixObj.Get("indices").As<Napi::Int32Array>().Data(),
    matrixVals.Data(),
    hessianStarts,
    hessianIndices,
    hessianValues,
    obj.Get("integrality").As<Napi::Int32Array>().Data()
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
  return Napi::Number::New(env, (double) this->highs_->getModelStatus());
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

class WriteSolutionWorker : public UpdateWorker {
 public:
  WriteSolutionWorker(Napi::Function& cb, std::shared_ptr<Highs> highs, std::string path)
  : UpdateWorker(cb, highs, "Write solution"), path_(path) {}

  HighsStatus Update(Highs& highs) override {
    return highs.writeSolution(this->path_);
  }

 private:
  std::string path_;
};

void Solver::WriteSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 2 || !info[0].IsString() ||!info[1].IsFunction()) {
    ThrowTypeError(env, "Expected 2 arguments [string, function]");
    return;
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();
  Napi::Function cb = info[1].As<Napi::Function>();
  WriteSolutionWorker* worker = new WriteSolutionWorker(cb, this->highs_, path);
  worker->Queue();
}

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
