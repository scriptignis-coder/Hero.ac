import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLeaderboard } from '../api/leaderboard.js';
const users=[{discord_id:'123456789012345678',opted_in:true},{discord_id:'223456789012345678',opted_in:false}];
const pin=(id,findings,used=true)=>({used,discord_check:{user:{id,name:'Member '+id.slice(0,3),avatar:null}},report:{Detections:Array(findings).fill({})}});
test('only consenting users are displayed',()=>{const rows=aggregateLeaderboard(users,[pin('123456789012345678',2),pin('223456789012345678',8)]);assert.equal(rows.length,1);assert.equal(rows[0].value,1)});
test('top checks counts completed scans, not incomplete scans',()=>{const rows=aggregateLeaderboard(users,[pin('123456789012345678',2),pin('123456789012345678',5,false)]);assert.equal(rows[0].value,1)});
test('top findings counts reported findings, not cheating convictions',()=>{const rows=aggregateLeaderboard(users,[pin('123456789012345678',2),pin('123456789012345678',3)],'findings');assert.equal(rows[0].value,5)});
test('no public IDs or report contents',()=>{const rows=aggregateLeaderboard(users,[pin('123456789012345678',2)]);assert.deepEqual(Object.keys(rows[0]).sort(),['avatar','name','value'])});
