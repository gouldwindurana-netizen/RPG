/* Original shared consumables. Effects are resolved by the combat model;
 * this catalog contains no state, random rolls, DOM code or provider assets. */
const AVELUNE_ITEM_CATALOG = Object.freeze(Object.fromEntries([
  {id:'potion',name:'Potion',price:25,tier:1,effect:'heal',amount:70,resource:'hp',target:'ally',
    description:'Restore 70 HP to one living ally.'},
  {id:'ether',name:'Ether',price:65,tier:1,effect:'mana',amount:24,resource:'mp',target:'ally',
    description:'Restore 24 MP to one living ally.'},
  {id:'revive',name:'Dawn feather',price:90,tier:1,effect:'revive',hpFraction:.5,resource:'hp',target:'ally',
    description:'Revive one fallen ally at half HP.'},
  {id:'hipotion',name:'High potion',price:100,tier:2,effect:'heal',amount:180,resource:'hp',target:'ally',
    description:'Restore 180 HP to one living ally.'},
  {id:'tent',name:'Tent',price:60,tier:1,effect:'camp',hpFraction:.5,mpFraction:.25,target:'party',fieldOnly:true,
    description:'Outdoors: restore half of living allies’ maximum HP and a quarter of their maximum MP. Cannot revive.'},
  {id:'cottage',name:'Cottage kit',price:220,tier:2,effect:'camp',hpFraction:1,mpFraction:1,target:'party',fieldOnly:true,
    description:'Outdoors: fully restore living allies’ HP and MP. Cannot revive.'},
  {id:'hiether',name:'High ether',price:180,tier:3,effect:'mana',amount:60,resource:'mp',target:'ally',
    description:'Restore 60 MP to one living ally.'},
  {id:'elixir',name:'Hearth elixir',price:600,tier:5,effect:'restore',hpFraction:1,mpFraction:1,target:'ally',
    description:'Fully restore one living ally’s HP and MP. Cannot revive.'},
  {id:'dew',name:'Morning dew',price:150,tier:2,effect:'partyHeal',amount:60,resource:'hp',target:'party',
    description:'Restore 60 HP to every living party member. Cannot revive.'},
  {id:'smokebomb',name:'Smoke bomb',price:100,tier:1,effect:'escape',target:'escape',battleOnly:true,bossAllowed:false,
    description:'Escape an ordinary encounter immediately. Guardians block its use.'},
  {id:'wardtonic',name:'Ward tonic',price:90,tier:2,effect:'ward',target:'party',rounds:3,damageMultiplier:.8,battleOnly:true,
    description:'Reduce damage to the party by 20% for three battle rounds.'},
  {id:'bomb',name:'Ember bomb',price:80,tier:1,effect:'damage',power:60,element:'ember',target:'enemy',battleOnly:true,
    description:'Blast one foe with ember damage. Exploit an ember weakness.'},
  {id:'iceshard',name:'Frost shard',price:80,tier:2,effect:'damage',power:60,element:'frost',target:'enemy',battleOnly:true,
    description:'Strike one foe with frost damage. Exploit a frost weakness.'},
  {id:'stormorb',name:'Storm orb',price:140,tier:3,effect:'damage',power:45,element:'bolt',target:'allEnemies',battleOnly:true,
    description:'Release bolt damage against every foe. Useful against clustered enemies.'},
].map(item => [item.id,Object.freeze(item)])));

if(typeof module!=='undefined')module.exports={AVELUNE_ITEM_CATALOG};
