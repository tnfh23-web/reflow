import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAddress,verifyHost} from '../cloud/network.mjs';
test('private, local, reserved and documentation addresses are rejected',()=>{
 for(const ip of ['127.0.0.1','10.1.1.1','172.16.1.1','192.168.1.1','169.254.169.254','100.64.1.1','0.0.0.0','224.1.1.1','198.18.0.1','198.51.100.1','203.0.113.1','::1','fc00::1','fe80::1','2001:db8::1','bad'])assert.equal(publicAddress(ip),false,ip);
 for(const ip of ['1.1.1.1','93.184.216.34','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('DNS with any private answer fails closed; absent answers and provider errors fail closed',async()=>{
 await verifyHost('example.com',async()=>Response.json({Answer:[{type:1,data:'93.184.216.34'}]}));
 await assert.rejects(()=>verifyHost('mixed.example',async()=>Response.json({Answer:[{type:1,data:'93.184.216.34'},{type:1,data:'127.0.0.1'}]})));
 await assert.rejects(()=>verifyHost('none.example',async()=>Response.json({Answer:[]})));
 await assert.rejects(()=>verifyHost('error.example',async()=>new Response(null,{status:503})));
});
