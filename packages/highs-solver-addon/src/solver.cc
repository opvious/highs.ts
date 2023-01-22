#include "solver.h"

void Solver::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env,
                  "Solver",
                  {InstanceMethod("passModel", &Solver::PassModel),
                   InstanceMethod("readModel", &Solver::ReadModel),
                   InstanceMethod("run", &Solver::Run),
                   InstanceMethod("getSolution", &Solver::GetSolution),
                   InstanceMethod("writeSolution", &Solver::WriteSolution),
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
  if (length != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected a single string argument").ThrowAsJavaScriptException();
    return;
  }
  std::string log_path = info[0].As<Napi::String>().Utf8Value();
  this->highs_ = std::make_shared<Highs>();
  HighsStatus status;
  status = this->highs_->setOptionValue(kLogFileString, log_path);
  if (status != HighsStatus::kOk) {
    Napi::Error::New(env, "Invalid log path").ThrowAsJavaScriptException();
    return;
  }
  status = this->highs_->setOptionValue("log_to_console", false);
  if (status != HighsStatus::kOk) {
    Napi::Error::New(env, "Failed to disable console logging").ThrowAsJavaScriptException();
    return;
  }
}

int32_t ToMatrixFormat(const Napi::Value& val) {
  bool b = val.As<Napi::Boolean>().Value();
  MatrixFormat f = b ? MatrixFormat::kColwise : MatrixFormat::kRowwise;
  return (int32_t) f;
}

int32_t ToSense(const Napi::Value& val) {
  bool b = val.As<Napi::Boolean>().Value();
  ObjSense s = b ? ObjSense::kMaximize : ObjSense::kMinimize;
  return (int32_t) s;
}

void Solver::PassModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Expected a single object argument").ThrowAsJavaScriptException();
    return;
  }
  Napi::Object obj = info[0].As<Napi::Object>();

  Napi::Value matrixVal = obj.Get("matrix");
  if (!matrixVal.IsObject()) {
    Napi::TypeError::New(env, "Invalid matrix").ThrowAsJavaScriptException();
    return;
  }
  Napi::Object matrixObj = matrixVal.As<Napi::Object>();

  Napi::Value hessianObj = obj.Get("hessian");

  HighsStatus status = this->highs_->passModel(
    matrixObj.Get("columnCount").As<Napi::Number>().Int64Value(),
    matrixObj.Get("rowCount").As<Napi::Number>().Int64Value(),
    matrixObj.Get("nonZeroCount").As<Napi::Number>().Int64Value(),
    0,
    ToMatrixFormat(matrixObj.Get("isColumnOriented")),
    1,
    ToSense(obj.Get("isMaximization")),
    obj.Get("offset").As<Napi::Number>().DoubleValue(),
    obj.Get("costs").As<Napi::Float64Array>().Data(), // col_cost
    obj.Get("columnLowerBounds").As<Napi::Float64Array>().Data(), // col_lower
    obj.Get("columnUpperBounds").As<Napi::Float64Array>().Data(), // col_upper
    obj.Get("rowLowerBounds").As<Napi::Float64Array>().Data(), // row_lower
    obj.Get("rowUpperBounds").As<Napi::Float64Array>().Data(), // row_upper
    nullptr, // a_start
    nullptr, // a_index
    nullptr, // q_value
    nullptr, // q_start
    nullptr, // q_index
    nullptr, // q_value
    nullptr // integrality
  );
  if (status != HighsStatus::kOk) {
    Napi::Error::New(env, "Model could not be read").ThrowAsJavaScriptException();
    return;
  }
}

void Solver::ReadModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected a single string argument").ThrowAsJavaScriptException();
    return;
  }
  HighsStatus status = this->highs_->readModel(info[0].As<Napi::String>().Utf8Value());
  if (status != HighsStatus::kOk) {
    Napi::Error::New(env, "Model could not be read").ThrowAsJavaScriptException();
    return;
  }
}

class RunWorker : public Napi::AsyncWorker {
 public:
  RunWorker(Napi::Function& callback, std::shared_ptr<Highs> highs)
  : Napi::AsyncWorker(callback), highs_(highs) {}

  void Execute() override {
    HighsStatus status = this->highs_->run();
    if (status != HighsStatus::kOk) {
      SetError("Run failed");
    }
  }

  void OnOK() override {
    Napi::HandleScope scope(Env());
    Callback().Call({Env().Null()});
  }

 private:
  std::shared_ptr<Highs> highs_;
};

void Solver::Run(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Expected a single function argument").ThrowAsJavaScriptException();
    return;
  }
  Napi::Function cb = info[0].As<Napi::Function>();
  RunWorker* worker = new RunWorker(cb, this->highs_);
  worker->Queue();
}

Napi::Value ToFloat64Array(Napi::Env& env, const std::vector<double>& vec) {
  Napi::Float64Array arr = Napi::Float64Array::New(env, vec.size());
  std::copy(vec.begin(), vec.end(), arr.Data());
  return arr;
}

Napi::Value Solver::GetSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    Napi::TypeError::New(env, "Unexpected argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  Napi::Object obj = Napi::Object::New(env);
  const HighsSolution& sol = this->highs_->getSolution();
  obj.Set("isValid", sol.value_valid);
  obj.Set("isDualValid", sol.dual_valid);
  obj.Set("columnValues", ToFloat64Array(env, sol.col_value));
  obj.Set("columnDualValues", ToFloat64Array(env, sol.col_dual));
  obj.Set("rowValues", ToFloat64Array(env, sol.row_value));
  obj.Set("rowDualValues", ToFloat64Array(env, sol.row_dual));
  return obj;
}

void Solver::WriteSolution(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected a single string argument").ThrowAsJavaScriptException();
    return;
  }
  HighsStatus status = this->highs_->writeSolution(info[0].As<Napi::String>().Utf8Value());
  if (status != HighsStatus::kOk) {
    Napi::Error::New(env, "Solution could not be written").ThrowAsJavaScriptException();
    return;
  }
}

void Solver::Clear(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int length = info.Length();
  if (length != 0) {
    Napi::TypeError::New(env, "Unexpected argument").ThrowAsJavaScriptException();
    return;
  }
  HighsStatus status = this->highs_->clear();
  if (status != HighsStatus::kOk) {
    Napi::Error::New(env, "Clear failed").ThrowAsJavaScriptException();
    return;
  }
}
