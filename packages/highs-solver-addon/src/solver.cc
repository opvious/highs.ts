#include "solver.h"

void Solver::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env,
                  "Solver",
                  {InstanceMethod("readModel", &Solver::ReadModel),
                   InstanceMethod("run", &Solver::Run),
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
