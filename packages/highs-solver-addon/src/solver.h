#ifndef HIGHS_ADDON_SOLVER_H
#define HIGHS_ADDON_SOLVER_H

#include "util.h"

class Solver : public Napi::ObjectWrap<Solver> {
 public:
  static void Init(Napi::Env env, Napi::Object exports);
  Solver(const Napi::CallbackInfo& info);

 private:
  void Clear(const Napi::CallbackInfo& info);
  void ReadModel(const Napi::CallbackInfo& info);
  void Run(const Napi::CallbackInfo& info);
  void WriteSolution(const Napi::CallbackInfo& info);

  std::shared_ptr<Highs> highs_;
};

#endif
