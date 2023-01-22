#include "util.h"

Napi::Value SolverVersion(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() > 0) {
    Napi::TypeError::New(env, "Too many arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::String::New(env, highsVersion());
}
