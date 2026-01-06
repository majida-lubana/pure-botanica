/* global Swal */
async function toggleBlock(userId, isBlocked, buttonElement) {
  // Convert string to boolean if needed
  isBlocked = isBlocked === true || isBlocked === 'true';

  const result = await Swal.fire({
    title: isBlocked?"Unblock User?":"Block User?",
    text:isBlocked
              ?"Do you really want to unblock this user?"
              :"Do you really want to block this user?",
    icon:"warning",
    showCancelButton:true,
    confirmButtonColor:"#3085d6",
    cancelButtonColor:"#d33",
    confirmButtonText:isBlocked?"Yes Unblock":"Yes Block"
  })
  if(!result.isConfirmed){
    return;
  }
  
  try {
    const res = await fetch(`/admin/${isBlocked ? 'unblock' : 'block'}/${userId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    });
    
    const data = await res.json();

    if (data.success) {
      if (isBlocked) {
        // User was blocked, now unblocked -> show Block button
        buttonElement.innerHTML = '<i class="fas fa-lock me-1"></i>Block';
        buttonElement.classList.remove('btn-unblock');
        buttonElement.classList.add('btn-block');

         buttonElement.setAttribute('onclick', `toggleBlock('${userId}', false, this)`)
      } else {
        // User was unblocked, now blocked -> show UnBlock button
        buttonElement.innerHTML = '<i class="fas fa-unlock me-1"></i>UnBlock';
        buttonElement.classList.remove('btn-block');
        buttonElement.classList.add('btn-unblock');
        
        buttonElement.setAttribute('onclick', `toggleBlock('${userId}', true, this)`)
      }
    } else {
      Swal.fire("Failed!", data.message || "Action could not be completed.", "error");
    }
  } catch (error) {
    console.error(error);
    Swal.fire("Error!", "Something went wrong. Please try again.", "error");
  }


}


window.toggleBlock = toggleBlock;
