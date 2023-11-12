#ifndef HIGHS_ADDON_SOLVER_H
#define HIGHS_ADDON_SOLVER_H

#include "util.h"

class Solver : public Napi::ObjectWrap<Solver> {
 public:
  static void Init(Napi::Env env, Napi::Object exports);
  Solver(const Napi::CallbackInfo& info);

 private:
  void SetOption(const Napi::CallbackInfo& info);
  Napi::Value GetOption(const Napi::CallbackInfo& info);

  void PassModel(const Napi::CallbackInfo& info);
  void ReadModel(const Napi::CallbackInfo& info);
  void WriteModel(const Napi::CallbackInfo& info);

  void ChangeObjectiveSense(const Napi::CallbackInfo& info);
  void ChangeObjectiveOffset(const Napi::CallbackInfo& info);
  void ChangeColsCost(const Napi::CallbackInfo& info);
  void AddRows(const Napi::CallbackInfo& info);

  void SetCallback(const Napi::CallbackInfo& info);
  void StartCallback(const Napi::CallbackInfo& info);
  void StopCallback(const Napi::CallbackInfo& info);

  void Run(const Napi::CallbackInfo& info);
  Napi::Value GetModelStatus(const Napi::CallbackInfo& info);
  Napi::Value GetInfo(const Napi::CallbackInfo& info);

  Napi::Value GetSolution(const Napi::CallbackInfo& info);
  void SetSolution(const Napi::CallbackInfo& info);
  void WriteSolution(const Napi::CallbackInfo& info);
  Napi::Value AssessPrimalSolution(const Napi::CallbackInfo& info);

  void Clear(const Napi::CallbackInfo& info);
  void ClearModel(const Napi::CallbackInfo& info);
  void ClearSolver(const Napi::CallbackInfo& info);

  std::shared_ptr<Highs> highs_;
};

#endif
