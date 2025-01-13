cmake_minimum_required(VERSION 3.22)

cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project(highs_addon)

add_definitions(-DNAPI_VERSION=8)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Generate node.lib if needed (Windows-specific)
if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET})
endif()

# Download HiGHS
include(ExternalProject)
ExternalProject_Add(highs_download
  GIT_REPOSITORY https://github.com/ERGO-Code/HiGHS.git
  GIT_TAG "66f735e60ce4d4835edaa05a35f2bd4048969c54" # v1.9.0
  CMAKE_ARGS
    -DCI=OFF
    -DFAST_BUILD=OFF
    -DBUILD_SHARED_LIBS=ON
    -DCMAKE_BUILD_TYPE=Release
  BUILD_COMMAND ${CMAKE_COMMAND} --build . --config Release --target libhighs
  INSTALL_COMMAND ""
)
ExternalProject_Get_Property(highs_download source_dir)
ExternalProject_Get_Property(highs_download binary_dir)

# Build binding
include_directories(${CMAKE_JS_INC} ${source_dir}/src ${binary_dir})
file(GLOB SOURCE_FILES "src/*.cc")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Set HiGHS library path based on platform
if(MSVC)
  set(HIGHS_LIB_PATH "${binary_dir}/bin/Release/highs.dll")
  set(HIGHS_IMPORT_LIB "${binary_dir}/lib/Release/highs.lib")
else()
  set(HIGHS_LIB_PATH "${binary_dir}/lib/libhighs.so")
  set(HIGHS_IMPORT_LIB "${HIGHS_LIB_PATH}")
endif()

# Make sure we link against the correct libraries
if(MSVC)
  target_link_libraries(${PROJECT_NAME} 
    ${CMAKE_JS_LIB}
    ${HIGHS_IMPORT_LIB}
    "${CMAKE_JS_NODELIB_TARGET}"
  )
else()
  target_link_libraries(${PROJECT_NAME} 
    ${CMAKE_JS_LIB}
    ${HIGHS_IMPORT_LIB}
  )
endif()

# Make sure highs_download is built before the addon
add_dependencies(${PROJECT_NAME} highs_download)

# Copy highs.dll to the output directory after highs is built
if(MSVC)
  add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:${PROJECT_NAME}>
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      ${HIGHS_LIB_PATH}
      $<TARGET_FILE_DIR:${PROJECT_NAME}>/highs.dll
    DEPENDS highs_download
  )
endif()