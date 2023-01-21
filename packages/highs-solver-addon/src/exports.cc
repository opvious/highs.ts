#include "util.h"
#include "solver.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("vendorVersion", Napi::Function::New(env, VendorVersion));
  return exports;
}

NODE_API_MODULE(highs_addon, Init)
