#ifndef HIGHS_ADDON_UTIL_H
#define HIGHS_ADDON_UTIL_H

#include <napi.h>
#include <Highs.h>

Napi::Value SolverVersion(const Napi::CallbackInfo &info);

void ThrowError(const Napi::Env& env, const std::string msg);

void ThrowTypeError(const Napi::Env& env, const std::string msg);

void AssignToVector(std::vector<double>& vec, Napi::Value val);

#endif
