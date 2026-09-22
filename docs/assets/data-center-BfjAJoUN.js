import"./supabase-ZrA-IRof.js";import{I as e,h as t}from"./user-DENhPopw.js";import{t as n}from"./pagination-DVzefm8X.js";var{supabase:r,keysToSnakeDeep:i,responseHandle:a}=e(),o=500;new t({idKey:`id`,parentKey:`parentId`,childrenKey:`children`});async function s(){return await n(({from:e,to:t})=>{let n=r.from(`sys_dictionary`).select(`
          id,
          type_id,
          code,
          label,
          value,
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
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}).range(e,t);return a(()=>n,{})},{pageSize:o})}async function c(e){return await a(()=>r.from(`sys_dictionary`).select(`
          id,
          type_id,
          code,
          label,
          value,
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
        `).eq(`status`,`1`).eq(`dict_type_table.status`,`1`).eq(`dict_type_table.code`,e).order(`sort`,{ascending:!0}).order(`id`,{ascending:!0}),{})}export{s as fetchGetDictList,c as fetchGetDictListByTypeCode};