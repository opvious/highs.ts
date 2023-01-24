#include "solver.h"
#include "util.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  Solver::Init(env, exports);
  exports.Set("solverVersion", Napi::Function::New(env, SolverVersion));
  return exports;
}

NODE_API_MODULE(highs_addon, InitAll)
