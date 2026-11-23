const {test,expect}=require('@playwright/test');
const {lessons}=require('../scripts/export-content.cjs');
async function onboard(page){await page.goto('/');await page.getByTestId('start-learning').click();await expect(page.getByText('Что откроем сегодня?')).toBeVisible();}
async function openLesson(page,l){await page.getByRole('tab',{name:'Уроки',exact:true}).click();await page.getByRole('radio',{name:l.grade+' класс',exact:true}).click();await page.getByText(l.title.ru,{exact:true}).click();await page.getByRole('button',{name:'Дальше',exact:false}).click();await page.getByRole('button',{name:'Попробовать самому',exact:false}).click();}
async function solve(page,l){const a=l.activity;
 if(a.kind==='choice'){await page.getByText(a.options[a.answer].ru,{exact:true}).click();await page.getByRole('button',{name:'Проверить ответ',exact:true}).click();}
 if(a.kind==='pairs'){for(const pair of a.pairs){await page.getByText(pair[0].ru,{exact:true}).click();await page.getByText(pair[1].ru,{exact:true}).click();}}
 if(a.kind==='order'){for(const item of a.items)await page.getByText(item.ru,{exact:true}).click();await page.getByRole('button',{name:'Проверить',exact:true}).click();}
 if(a.kind==='robot'){for(const d of ['↑','↑','↑','→','→','→'])await page.getByRole('button',{name:d,exact:true}).click();await page.getByRole('button',{name:/Запустить/}).click();}
 if(a.kind==='art'){await page.getByRole('button',{name:'triangle',exact:true}).click();await page.getByRole('button',{name:'Клетка 2',exact:true}).click();await page.getByRole('button',{name:'square',exact:true}).click();await page.getByRole('button',{name:'Клетка 5',exact:true}).click();await page.getByRole('button',{name:'circle',exact:true}).click();await page.getByRole('button',{name:'Клетка 5',exact:true}).click();await page.getByRole('button',{name:'Готово',exact:true}).click();}
 if(a.kind!=='choice'){await page.getByText(l.check.options[l.check.answer].ru,{exact:true}).click();await page.getByRole('button',{name:'Проверить ответ',exact:true}).click();}
 await expect(page.getByText('Урок пройден!',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Назад к урокам',exact:true}).click();
}
test('responsive UI, all activity types, persistent completion and Kazakh',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await onboard(page);
 await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
 for(const id of ['g1-01','g1-02','g1-03','g1-04','g2-11']){const l=lessons.find(x=>x.id===id);await openLesson(page,l);await solve(page,l);}
 await page.reload();await page.getByRole('tab',{name:'Прогресс',exact:true}).click();await expect(page.getByText('5 / 69',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Главная',exact:true}).click();await page.screenshot({path:'test-results/home-phone.png',fullPage:true});
 await page.getByRole('tab',{name:'Настройки',exact:true}).click();await page.getByRole('radio',{name:'Қазақша',exact:true}).click();await page.getByRole('tab',{name:'Сабақтар',exact:true}).click();await page.getByRole('radio',{name:'1 сынып',exact:true}).click();await page.getByText('Компьютер неден тұрады',{exact:true}).click();await expect(page.getByText('Пернетақта мен тінтуір компьютерге командалар береді.',{exact:false})).toBeVisible();await page.screenshot({path:'test-results/lesson-kazakh.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('every lesson is reachable and completable',async({page})=>{
 test.setTimeout(240000);await onboard(page);for(const l of lessons){await openLesson(page,l);await solve(page,l);}await page.getByRole('tab',{name:'Прогресс',exact:true}).click();await expect(page.getByText('69 / 69',{exact:true})).toBeVisible();
});

test('all activity types remain usable in dark theme',async({page})=>{
 await onboard(page);await page.getByRole('tab',{name:'Настройки',exact:true}).click();await page.getByTestId('theme-dark').click();
 for(const id of ['g1-01','g1-02','g1-03','g1-04','g2-11']){const l=lessons.find(x=>x.id===id);await openLesson(page,l);await solve(page,l);}
});
