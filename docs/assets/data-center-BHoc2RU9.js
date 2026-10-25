import{r as e}from"./rolldown-runtime-C0FnF6B9.js";import{J as t,g as n,q as r}from"./sys-BAeLMlQr.js";import"./supabase-1XyJdsHD.js";import{t as i}from"./filters-DGcpX8Yb.js";import{r as a}from"./pagination-BuPr9yVQ.js";var o=e({deleteResource:()=>g,fetchDictionaryDisplayItem:()=>p,fetchDictionaryList:()=>d,fetchDictionaryListByTypeCode:()=>f,fetchResourceList:()=>m,renameResource:()=>h}),{supabase:s,keysToSnakeDeep:c,responseHandle:l}=t(),u=500;new n({idKey:`id`,parentKey:`parentId`,childrenKey:`children`});async function d(){return await a(({from:e,to:t})=>{let n=s.from(`sys_dictionary`).select(`
          id,
          type_id,
          code,
          label,
          value,
          status,
          sort,
          color,
          tag_type,
          remark,
          parent_id,
          cascade_parent_id,
          dict_type_table:sys_dict_type!inner(
            code,
            name
          )
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}).range(e,t);return l(()=>n,{})},{pageSize:u})}async function f(e){return await l(()=>s.from(`sys_dictionary`).select(`
          id,
          type_id,
          code,
          label,
          value,
          status,
          sort,
          color,
          tag_type,
          remark,
          parent_id,
          cascade_parent_id,
          dict_type_table:sys_dict_type!inner(
            code,
            name
          )
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).eq(`dict_type_table.code`,e).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}),{})}async function p(e,t){return l(()=>s.from(`sys_dictionary`).select(`id,type_id,code,label,value,status,sort,color,tag_type,remark,parent_id,cascade_parent_id,dict_type_table:sys_dict_type!inner(code,name)`).eq(`dict_type_table.code`,e).eq(`value`,t).order(`id`,{ascending:!0}).limit(1),{})}async function m(e){let{originName:t=``,suffix:n=``,tenantId:r,from:a=0,to:o=9}=e,c=[{col:`originName`,op:`ilike`,val:`%${t}%`}];if(n){let e=n.split(`,`).map(e=>e.trim()).filter(e=>e.length>0);e.length>0&&c.push({col:`suffix`,op:`in`,val:e})}let u=s.from(`sys_attachment`).select(`*`,{count:`exact`}).order(`create_time`,{ascending:!1}).range(a,o);return r&&(u=u.eq(`tenant_id`,r)),u=i(u,c,{skipEmpty:!0,camelToSnake:!0}),await l(()=>u,{showErrorMessage:!0})}async function h(e){let{id:t,originName:n}=e;return await l(()=>s.from(`sys_attachment`).update({origin_name:n},{count:`exact`}).eq(`id`,t),{breakReturn:!0,requireAffected:!0,noAffectedMessage:r,errorMessage:`附件重命名失败，请稍后重试`})}async function g(e){let{id:t}=e,{data:n}=await l(()=>s.from(`sys_attachment`).select().eq(`id`,t).single(),{});if(!n)throw Error(`未找到待删除的附件`);let{storagePath:i,objectName:a}=n;if(await l(()=>s.from(`sys_attachment`).delete({count:`exact`}).eq(`id`,t),{breakReturn:!0,requireAffected:!0,noAffectedMessage:r,errorMessage:`附件删除失败，请稍后重试`}),!i||!a)return{storageCleanupFailed:!1};let o=`${i}/${a}`,{error:c}=await s.storage.from(`attachments`).remove([o]);return c?(console.warn(`[AttachmentCleanup] 附件记录已删除，但存储对象清理失败:`,c),{storageCleanupFailed:!0}):{storageCleanupFailed:!1}}export{h as i,g as n,m as r,o as t};