cmake_minimum_required(VERSION 3.15)

cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project(highs_solver)

add_definitions(-DNAPI_VERSION=8)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Download and build HiGHS

include(ExternalProject)
ExternalProject_Add(highs_download
  GIT_REPOSITORY https://github.com/ERGO-Code/HiGHS.git
  GIT_TAG "b3381829e67eaea53637586a612164e296a7ac97"
  CMAKE_ARGS -DBUILD_TESTING=OFF -DCI=OFF -DSHARED=OFF
)

find_package(Threads) # Required for building HiGHS
ExternalProject_Get_Property(highs_download binary_dir)
set(highs_DIR binary_dir)
find_package(highs REQUIRED)

# Build binding

include_directories(${CMAKE_JS_INC} ${HIGHS_INCLUDE_DIRS})
file(GLOB SOURCE_FILES "src/*.cc")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} libhighs)
