import{r as e}from"./rolldown-runtime-C0FnF6B9.js";import{t}from"./filters-DGcpX8Yb.js";import{r as n}from"./pagination-CL-d5xHC.js";import{L as r,R as i,x as a}from"./index-Bg_MSei_.js";var o=e({deleteResource:()=>h,fetchDictionaryList:()=>d,fetchDictionaryListByTypeCode:()=>f,fetchResourceList:()=>p,renameResource:()=>m}),{supabase:s,keysToSnakeDeep:c,responseHandle:l}=i(),u=500;new a({idKey:`id`,parentKey:`parentId`,childrenKey:`children`});async function d(){return await n(({from:e,to:t})=>{let n=s.from(`sys_dictionary`).select(`
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
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).eq(`dict_type_table.code`,e).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}),{})}async function p(e){let{originName:n=``,suffix:r=``,tenantId:i,from:a=0,to:o=9}=e,c=[{col:`originName`,op:`ilike`,val:`%${n}%`}];if(r){let e=r.split(`,`).map(e=>e.trim()).filter(e=>e.length>0);e.length>0&&c.push({col:`suffix`,op:`in`,val:e})}let u=s.from(`sys_attachment`).select(`*`,{count:`exact`}).order(`create_time`,{ascending:!1}).range(a,o);return i&&(u=u.eq(`tenant_id`,i)),u=t(u,c,{skipEmpty:!0,camelToSnake:!0}),await l(()=>u,{showErrorMessage:!0})}async function m(e){let{id:t,originName:n}=e;return await l(()=>s.from(`sys_attachment`).update({origin_name:n},{count:`exact`}).eq(`id`,t),{breakReturn:!0,requireAffected:!0,noAffectedMessage:r,errorMessage:`附件重命名失败，请稍后重试`})}async function h(e){let{id:t}=e,{data:n}=await l(()=>s.from(`sys_attachment`).select().eq(`id`,t).single(),{});if(!n)throw Error(`未找到待删除的附件`);let{storagePath:i,objectName:a}=n;if(await l(()=>s.from(`sys_attachment`).delete({count:`exact`}).eq(`id`,t),{breakReturn:!0,requireAffected:!0,noAffectedMessage:r,errorMessage:`附件删除失败，请稍后重试`}),!i||!a)return{storageCleanupFailed:!1};let o=`${i}/${a}`,{error:c}=await s.storage.from(`attachments`).remove([o]);return c?(console.warn(`[AttachmentCleanup] 附件记录已删除，但存储对象清理失败:`,c),{storageCleanupFailed:!0}):{storageCleanupFailed:!1}}export{m as i,h as n,p as r,o as t};