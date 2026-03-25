
// === GLOBAL FIX ===
window.activeBattleChatRoomKey = null;

// existing code placeholder...
function clearBattleScene(){
    if(window.activeBattleChatRoomKey){
        // safe cleanup
        window.activeBattleChatRoomKey = null;
    }
}

// MUTE CHECK EXAMPLE
function canSendMessage(player){
    if(player.isMuted){
        alert("Вы замучены");
        return false;
    }
    return true;
}
