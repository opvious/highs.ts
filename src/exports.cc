#include "util.h"
#include "solver.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("magicValue", Napi::Function::New(env, MagicValue));
  return exports;
}

NODE_API_MODULE(highs, Init)
