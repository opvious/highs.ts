#include "solver.h"

Napi::Value MagicValue(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (info.Length() > 0) {
    Napi::TypeError::New(env, "Too many arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Number result = Napi::Number::New(env, MAGIC);

  return result;
}
