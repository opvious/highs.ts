#ifndef HIGHS_ADDON_UTIL_H
#define HIGHS_ADDON_UTIL_H

#include <napi.h>
#include <Highs.h>

Napi::Value SolverVersion(const Napi::CallbackInfo &info);

#endif
