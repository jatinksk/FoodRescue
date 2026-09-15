async function loadStats(){
  const r=await fetch("/api/stats"); const d=await r.json();
  for(const k of ["donations","servings","pickups","volunteers"]) document.getElementById(k).textContent=d[k];
}
async function loadCategories(){
  const r=await fetch("/api/categories"); const data=await r.json();
  document.getElementById("category").innerHTML=data.map(x=>`<option value="${x.category_id}">${x.category_name}</option>`).join("");
}
async function loadFood(){
  const r=await fetch("/api/food"); const data=await r.json();
  const grid=document.getElementById("foodGrid");
  if(!data.length){grid.innerHTML="<p>No food listings available right now.</p>";return;}
  grid.innerHTML=data.map(f=>`
    <article class="food-card">
      <span class="tag">${f.category_name}</span>
      <h3>${f.food_name}</h3>
      <p>${f.description||"Surplus food available for rescue."}</p>
      <p><b>${f.quantity} ${f.unit}</b><br>📍 ${f.pickup_location}<br>⏰ Expires ${new Date(f.expiry_datetime).toLocaleString()}</p>
      <button class="primary" onclick="requestPickup(${f.food_id})">Request Pickup</button>
    </article>`).join("");
}
async function requestPickup(food_id){
  const r=await fetch("/api/pickups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({food_id,volunteer_id:4})});
  const d=await r.json(); alert(d.message||d.error); loadFood(); loadStats();
}
document.getElementById("foodForm").addEventListener("submit",async e=>{
  e.preventDefault(); const body=Object.fromEntries(new FormData(e.target));
  body.quantity=Number(body.quantity); body.category_id=Number(body.category_id);
  const r=await fetch("/api/food",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json(); document.getElementById("formMsg").textContent=d.message||d.error;
  if(r.ok){e.target.reset();loadFood();loadStats();}
});
loadStats();loadCategories();loadFood();
