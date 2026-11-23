const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./e2e',timeout:120000,workers:1,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:8787',headless:true,viewport:{width:1280,height:900},screenshot:'only-on-failure',trace:'retain-on-failure'}});
