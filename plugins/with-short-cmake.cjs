const {withAppBuildGradle}=require('@expo/config-plugins');
module.exports=config=>withAppBuildGradle(config,config=>{
 const contents=config.modResults.contents;
 if(!contents.includes('CMAKE_OBJECT_PATH_MAX'))config.modResults.contents=contents.replace('defaultConfig {','defaultConfig {\n        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } }');
 return config;
});
