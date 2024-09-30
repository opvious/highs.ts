cmake_minimum_required(VERSION 3.22)

cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project(highs_addon)

add_definitions(-DNAPI_VERSION=8)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Download HiGHS
include(ExternalProject)
ExternalProject_Add(highs_download
  GIT_REPOSITORY https://github.com/ERGO-Code/HiGHS.git
  GIT_TAG "50670fd4c634c3c9e54bf615e84bd4024d129754" # v1.7.0
  CMAKE_ARGS
    -DCI=OFF
    -DFAST_BUILD=OFF
    -DSHARED=OFF
    -DCMAKE_CXX_COMPILER_LAUNCHER=${CMAKE_CXX_COMPILER_LAUNCHER}
  BUILD_COMMAND ${CMAKE_COMMAND} --build . --target libhighs
  INSTALL_COMMAND ""
)
ExternalProject_Get_Property(highs_download source_dir)
ExternalProject_Get_Property(highs_download binary_dir)

# Build binding
include_directories(${CMAKE_JS_INC} ${source_dir}/src ${binary_dir})
file(GLOB SOURCE_FILES "src/*.cc")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} ${binary_dir}/lib/libhighs.a)
