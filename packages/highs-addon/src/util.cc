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

void ThrowError(const Napi::Env& env, const std::string msg) {
  Napi::Error::New(env, msg).ThrowAsJavaScriptException();
}

void ThrowTypeError(const Napi::Env& env, const std::string msg) {
  Napi::TypeError::New(env, msg).ThrowAsJavaScriptException();
}
