import{r as e}from"./rolldown-runtime-C0FnF6B9.js";import"./supabase-C06qkJwY.js";import{y as t}from"./user-DIQA7_LT.js";import{i as n,r}from"./useWebsiteConfig-CKWOIdy1.js";import{t as i}from"./filters-C-xPy3s5.js";var a=500;async function o(e,t={}){let n=t.pageSize??a;if(!Number.isInteger(n)||n<1)throw RangeError(`Supabase 分页大小必须是正整数`);let r=[];for(let t=0;;t+=n){let i=await e({from:t,to:t+n-1});if(i.error)return{data:null,error:i.error,total:r.length};if(!i.data)return{data:null,error:Error(`分页查询未返回数据，请稍后重试`),total:r.length};if(r.push(...i.data),i.data.length<n)return{data:r,error:null,total:r.length}}}var s=e({deleteResource:()=>g,fetchGetDictList:()=>f,fetchGetDictListByTypeCode:()=>p,fetchGetResourceList:()=>m,renameResource:()=>h}),{supabase:c,keysToSnakeDeep:l,responseHandle:u}=n(),d=500;new t({idKey:`id`,parentKey:`parentId`,childrenKey:`children`});async function f(){return await o(({from:e,to:t})=>{let n=c.from(`sys_dictionary`).select(`
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
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}).range(e,t);return u(()=>n,{})},{pageSize:d})}async function p(e){return await u(()=>c.from(`sys_dictionary`).select(`
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
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).eq(`dict_type_table.code`,e).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}),{})}async function m(e){let{originName:t=``,suffix:n=``,from:r=0,to:a=9}=e,o=[{col:`originName`,op:`ilike`,val:`%${t}%`}];if(n){let e=n.split(`,`).map(e=>e.trim()).filter(e=>e.length>0);e.length>0&&o.push({col:`suffix`,op:`in`,val:e})}let s=c.from(`sys_attachment`).select(`*`,{count:`exact`}).order(`create_time`,{ascending:!1}).range(r,a);return s=i(s,o,{skipEmpty:!0,camelToSnake:!0}),await u(()=>s,{showErrorMessage:!0})}async function h(e){let{id:t,originName:n}=e;return await u(()=>c.from(`sys_attachment`).update({origin_name:n},{count:`exact`}).eq(`id`,t),{breakReturn:!0,requireAffected:!0,noAffectedMessage:r,errorMessage:`附件重命名失败，请稍后重试`})}async function g(e){let{id:t}=e,{data:n}=await u(()=>c.from(`sys_attachment`).select().eq(`id`,t).single(),{});if(!n)throw Error(`未找到待删除的附件`);let{storagePath:i,objectName:a}=n;if(await u(()=>c.from(`sys_attachment`).delete({count:`exact`}).eq(`id`,t),{breakReturn:!0,requireAffected:!0,noAffectedMessage:r,errorMessage:`附件删除失败，请稍后重试`}),!i||!a)return{storageCleanupFailed:!1};let o=`${i}/${a}`,{error:s}=await c.storage.from(`attachments`).remove([o]);return s?(console.warn(`[AttachmentCleanup] 附件记录已删除，但存储对象清理失败:`,s),{storageCleanupFailed:!0}):{storageCleanupFailed:!1}}export{o as a,h as i,g as n,m as r,s as t};