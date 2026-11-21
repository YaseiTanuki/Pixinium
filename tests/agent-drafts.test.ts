import test from 'node:test'
import assert from 'node:assert/strict'
import {agentDraftUpdate,agentItemId} from '../lib/agent-drafts'
test('draft patches preserve omitted fields and reject publication, files, invalid IDs and duplicate metadata',()=>{
  const base={expectedUpdatedAt:'2026-11-21T00:00:00.123456+00:00',changes:{description:'New description'}}
  assert.deepEqual(agentDraftUpdate.parse(base),base)
  for(const changes of [{},{status:'published'},{attachments:[]},{slug:'different'},{title:''},{description:null},{tags:[{slug:'art',name:'Art'},{slug:'art',name:'Duplicate'}]}])assert.equal(agentDraftUpdate.safeParse({...base,changes}).success,false)
  assert.equal(agentDraftUpdate.safeParse({...base,status:'published'}).success,false)
  assert.equal(agentDraftUpdate.safeParse({...base,expectedUpdatedAt:'yesterday'}).success,false)
  for(const id of ['0','-1','9223372036854775808','1e2'])assert.equal(agentItemId.safeParse(id).success,false)
})
