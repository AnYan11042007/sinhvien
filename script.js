import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE",
    authDomain: "appsinhvien-24482.firebaseapp.com",
    databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "appsinhvien-24482"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let activeQuizId = null;
let quizTimerInterval = null;

function formatDate(dStr) {
    if(!dStr || dStr === 'Không có') return '';
    const parts = dStr.split('-');
    if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
}

// ==========================================
// 🎵 MUSIC & UI TABS
// ==========================================
window.toggleMusic = () => {
    const audio = document.getElementById('bgMusic'), btn = document.getElementById('music-toggle');
    if (audio.paused) { 
        audio.play().catch(() => alert("Bấm vào bất cứ đâu trên màn hình trước khi bật nhạc!")); 
        btn.innerHTML = '<i class="fas fa-volume-up"></i> [ TẮT NHẠC ]'; 
        btn.style.color = 'var(--neon-gold)'; 
    }
    else { audio.pause(); btn.innerHTML = '<i class="fas fa-music"></i> [ BẬT NHẠC ]'; btn.style.color = ''; }
};

window.switchTab = (tab) => {
    document.getElementById('nav-academic').classList.remove('active');
    document.getElementById('nav-casino').classList.remove('active');
    document.getElementById('tab-academic').style.display = 'none';
    document.getElementById('tab-casino').style.display = 'none';

    document.getElementById(`nav-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).style.display = 'grid'; // Grid layout
};

// ==========================================
// 🔐 AUTH & CORE
// ==========================================
window.login = async () => {
    const u = document.getElementById('username').value.trim(), p = document.getElementById('password').value.trim();
    const snap = await get(ref(db, `users/${u}`));
    if (snap.exists() && snap.val().pass === p) {
        if(snap.val().locked) return alert("ACCOUNT BỊ KHÓA!");
        localStorage.setItem('uid', u); location.reload();
    } else alert("SAI UID HOẶC PASS!");
};
window.logout = () => { localStorage.removeItem('uid'); location.reload(); };

function genClassOptions(sel, all = false) {
    let o = all ? '<option value="ALL">TẤT CẢ LỚP</option>' : '';
    for(let y=1; y<=4; y++) ['A','B','C','D'].forEach(b => { const v=`Y${y}_${b}`; o+=`<option value="${v}" ${v===sel?'selected':''}>Lớp ${y}-${b}</option>`; });
    return o;
}

const uid = localStorage.getItem('uid');
if (uid) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    if(document.getElementById('add-class-select')) {
        const opts = genClassOptions('Y1_A');
        document.getElementById('add-class-select').innerHTML = opts;
        document.getElementById('filter-class-select').innerHTML = genClassOptions('ALL', true);
    }
    loadSystem();
}

function loadSystem() {
    onValue(ref(db, `users/${uid}`), snap => {
        const u = snap.val(); if(!u) return;
        document.getElementById('avatar-container').innerHTML = u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<i class="fas fa-user-ninja"></i>`;
        document.getElementById('display-name').innerHTML = u.role === 'TEACHER' ? `${u.name} <i class="fas fa-pen" onclick="changeTeacherName()" style="font-size:10px;cursor:pointer;"></i>` : u.name;
        document.getElementById('role-badge').innerText = u.role === 'TEACHER' ? 'FACULTY' : `LỚP ${u.class}`;
        
        if(u.role === 'TEACHER') { 
            document.getElementById('teacher-view').style.display = 'block'; 
            document.getElementById('nav-academic').style.display = 'none'; // Giấu tab sinh viên
            document.getElementById('nav-casino').style.display = 'none';
            loadAdmin(); 
        }
        else { 
            document.getElementById('student-view').style.display = 'block'; 
            document.getElementById('nav-academic').style.display = 'flex'; // Hiện tab sinh viên
            document.getElementById('nav-casino').style.display = 'flex';
            loadStudent(u); 
        }
    });

    onValue(ref(db, 'classes'), snap => {
        const clss = snap.val() || {}; let data = Object.keys(clss).map(k => ({id:k, ...clss[k]})).sort((a,b) => b.cp - a.cp);
        let hS = "", hA = "";
        data.forEach((c, i) => {
            hS += `<tr><td>#${i+1}</td><td>Lớp ${c.name}</td><td class="text-gold">${c.cp}</td></tr>`;
            hA += `<tr><td class="text-blue">Lớp ${c.name}</td><td><input type="number" value="${c.cp}" onchange="window.upCP('${c.id}',this.value)" class="cyber-input" style="width:70px;padding:2px;text-align:center;"></td></tr>`;
        });
        if(document.getElementById('student-class-rank')) document.getElementById('student-class-rank').innerHTML = hS;
        if(document.getElementById('admin-class-control')) document.getElementById('admin-class-control').innerHTML = hA;
    });

    onValue(ref(db, 'users'), snap => {
        const us = snap.val() || {}; let arr = [];
        for(let id in us) if(us[id].role === 'STUDENT') arr.push({id, ...us[id]});
        arr.sort((a,b) => (Number(b.pp)||0) - (Number(a.pp)||0));
        let h = ""; arr.slice(0, 50).forEach((s, i) => h += `<tr><td>${s.id}</td><td>${s.name}</td><td class="text-gold">${(Number(s.pp)||0).toLocaleString()}</td></tr>`);
        if(document.getElementById('top-50-students')) document.getElementById('top-50-students').innerHTML = h;
    });
}

// ==========================================
// 🧑‍🎓 STUDENT
// ==========================================
function loadStudent(u) {
    document.getElementById('display-pp').innerText = (u.pp || 0).toLocaleString();
    const tb = document.getElementById('student-grades'); tb.innerHTML = '';
    if(u.academic) {
        Object.keys(u.academic).sort().forEach(tk => {
            tb.innerHTML += `<tr class="term-group-header"><td colspan="6">${tk}</td></tr>`;
            for(let sk in u.academic[tk]) {
                const s = u.academic[tk][sk];
                tb.innerHTML += `<tr><td>${s.name}</td><td>${s.bth}</td><td>${s.gk}</td><td>${s.ck}</td><td>${s.final}</td><td class="text-gold">${s.grade}</td></tr>`;
            }
        });
    }
    onValue(ref(db, 'quests'), s => {
        let h = ""; const qs = s.val() || {};
        for(let id in qs) if(qs[id].status === 'OPEN') {
            const att = qs[id].attempts?.[uid] || 0;
            const dLine = qs[id].deadline && qs[id].deadline !== 'Không có' ? ` | Hạn: ${formatDate(qs[id].deadline)}` : '';
            h += `<div class="mission-item"><div><h4 style="margin:0;">${qs[id].title}</h4><small>PP: ${qs[id].rewardPP} | Lượt: ${att}/${qs[id].maxAttempts}${dLine}</small></div><button onclick="openQuiz('${id}')" class="btn-cyber">GIẢI MÃ</button></div>`;
        }
        document.getElementById('student-mission-list').innerHTML = h;
    });
    onValue(ref(db, 'messages'), s => {
        let h = ""; const ms = s.val() || {};
        for(let id in ms) if(ms[id].senderUid === uid) {
            let col = ms[id].status === 'APPROVED' ? '#4ade80' : (ms[id].status === 'REJECTED' ? '#ff004c' : '#ffd700');
            h += `<tr><td>Tố cáo ${ms[id].targetUid}</td><td style="color:${col};font-weight:bold;">${ms[id].status}</td><td>${ms[id].adminReply||'...'}</td></tr>`;
        }
        document.getElementById('student-inbox').innerHTML = h;
    });
    const ctx = document.getElementById('radarChart'); if(ctx) {
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, { type: 'radar', data: { labels: ['Học','Thể','Tâm','Giao','Phán'], datasets: [{ data: u.stats || [50,50,50,50,50], backgroundColor: 'rgba(255,0,60,0.1)', borderColor: '#ff003c' }] }, options: { plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: '#333' } } } } });
    }
}

// ==========================================
// 👨‍🏫 ADMIN
// ==========================================
function loadAdmin() {
    const filter = document.getElementById('filter-class-select').value;
    onValue(ref(db, 'users'), s => {
        let h = ""; const us = s.val() || {}; let count = 0;
        let arr = [];
        for(let id in us) {
            if(us[id].role === 'STUDENT') {
                if(filter !== 'ALL' && us[id].classKey !== filter) continue;
                arr.push({id, ...us[id]});
            }
        }
        
        // FIX LỖI SẮP XẾP ADMIN: Dùng localeCompare để sắp xếp Lớp cực chuẩn
        arr.sort((a, b) => {
            const classA = a.classKey || "";
            const classB = b.classKey || "";
            if (classA === classB) {
                return (Number(b.pp) || 0) - (Number(a.pp) || 0); // Xếp PP giảm dần trong cùng 1 lớp
            }
            return classA.localeCompare(classB); // Xếp Lớp tăng dần (A -> Z)
        });

        arr.forEach(u => {
            count++;
            h += `<tr><td>${u.id}</td><td><input type="text" value="${u.name}" onchange="window.upU('${u.id}','name',this.value)" class="cyber-input" style="width:70px;"></td><td><input type="text" value="${u.pass}" onchange="window.upU('${u.id}','pass',this.value)" class="cyber-input" style="width:40px;"></td><td>Y:${u.year} S:${u.sem}</td><td><select onchange="window.upC('${u.id}',this.value)" class="cyber-input">${genClassOptions(u.classKey)}</select></td><td>${(Number(u.pp)||0).toLocaleString()}</td><td><button onclick="window.addPP('${u.id}')" class="btn-mini add">+PP</button><button onclick="window.subPP('${u.id}')" class="btn-mini sub">-PP</button><button onclick="window.openGrades('${u.id}','${u.name}')" class="btn-mini add">XEM</button><button onclick="window.openSubModal('${u.id}')" class="btn-mini add">+</button><button onclick="window.lockU('${u.id}',${!u.locked})" class="btn-mini del">${u.locked?'MỞ':'KHÓA'}</button><button onclick="window.delU('${u.id}')" class="btn-mini del">X</button></td></tr>`;
        });
        
        document.getElementById('admin-users').innerHTML = h; document.getElementById('student-count').innerText = count;
    });
    onValue(ref(db, 'quests'), s => {
        let h = ""; const qs = s.val() || {};
        for(let id in qs) {
            const dLine = qs[id].deadline && qs[id].deadline !== 'Không có' ? ` - Hạn: ${formatDate(qs[id].deadline)}` : '';
            h += `<div style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #333;"><span>${qs[id].title} <small style="color:#ff003c">${dLine}</small></span><button onclick="window.delQ('${id}')" class="btn-mini del">X</button></div>`;
        }
        document.getElementById('admin-quest-list').innerHTML = h;
    });
    onValue(ref(db, 'messages'), s => {
        let h = ""; const ms = s.val() || {};
        for(let id in ms) if(ms[id].status === 'PENDING') h += `<tr><td>${ms[id].senderName}</td><td>${ms[id].targetUid}</td><td>${ms[id].reason}</td><td><button onclick="window.replyM('${id}','APPROVED')" class="btn-mini add">V</button><button onclick="window.replyM('${id}','REJECTED')" class="btn-mini del">X</button></td></tr>`;
        document.getElementById('admin-messages').innerHTML = h;
    });
}

// --- GLOBALS ---
window.addPP = async (id) => {
    const amt = prompt("Nhập số PP muốn CỘNG thêm:");
    if(amt && !isNaN(amt)) {
        const s = await get(ref(db, `users/${id}`));
        await update(ref(db, `users/${id}`), { pp: (Number(s.val().pp) || 0) + parseInt(amt) });
    }
};
window.subPP = async (id) => {
    const amt = prompt("Nhập số PP muốn TRỪ đi:");
    if(amt && !isNaN(amt)) {
        const s = await get(ref(db, `users/${id}`));
        await update(ref(db, `users/${id}`), { pp: Math.max(0, (Number(s.val().pp) || 0) - parseInt(amt)) });
    }
};
window.upU = (id, k, v) => update(ref(db, `users/${id}`), { [k]: v });
window.delU = id => confirm("Xóa?") && remove(ref(db, `users/${id}`));
window.lockU = (id, st) => update(ref(db, `users/${id}`), { locked: st });
window.upCP = (id, v) => update(ref(db, `classes/${id}`), { cp: parseInt(v) });
window.delQ = id => remove(ref(db, `quests/${id}`));
window.upC = async (id, ck) => {
    const y = parseInt(ck[1]), block = ck.split('_')[1], name = `${y}-${block}`;
    await update(ref(db, `users/${id}`), { classKey: ck, class: name, year: y });
};
window.adminCreateQuest = async () => {
    const t = document.getElementById('q-title').value, q = document.getElementById('q-question').value, a = document.getElementById('q-optA').value, b = document.getElementById('q-optB').value, c = document.getElementById('q-correct').value;
    const pp = parseInt(document.getElementById('q-pp').value), pn = parseInt(document.getElementById('q-penalty').value), l = parseInt(document.getElementById('q-limit').value), m = parseInt(document.getElementById('q-max-attempts').value);
    const tm = parseInt(document.getElementById('q-time').value) || 0;
    const dl = document.getElementById('q-deadline').value || 'Không có';
    await set(ref(db, `quests/Q_${Date.now()}`), { title:t, question:q, optA:a, optB:b, correctOpt:c, rewardPP:pp, penaltyPP:pn, limit:l, maxAttempts:m, timeLimit: tm, deadline: dl, joined:0, status:'OPEN' });
    alert("ĐÃ ĐĂNG!");
};
window.forceInitClasses = async () => {
    const ups = {}; for(let y=1;y<=4;y++) ['A','B','C','D'].forEach(b => { const id=`Y${y}_${b}`; ups[`classes/${id}`] = { year:y, name:`${y}-${b}`, cp:1000 }; });
    await update(ref(db, '/'), ups); alert("XONG!");
};
window.replyM = async (id, st) => {
    const r = prompt("Lý do:"); if(r!==null) await update(ref(db, `messages/${id}`), { status: st, adminReply: r });
};

// --- QUIZ & GRADES ---
window.openQuiz = async id => {
    const s = await get(ref(db, `quests/${id}`)); const q = s.val();
    
    if(q.deadline && q.deadline !== 'Không có' && new Date() > new Date(q.deadline + "T23:59:59")) {
        return alert("BÀI NÀY ĐÃ HẾT HẠN LÀM!");
    }

    const att = q.attempts?.[uid] || 0; if(att >= q.maxAttempts) return alert("HẾT LƯỢT!");
    activeQuizId = id; document.getElementById('quiz-title').innerText = q.title; document.getElementById('quiz-question').innerText = q.question;
    document.getElementById('quiz-optA').innerText = q.optA; document.getElementById('quiz-optB').innerText = q.optB;
    document.getElementById('quiz-info').innerText = `Phạt: ${q.penaltyPP} PP | Lượt: ${att}/${q.maxAttempts}`;

    const tl = q.timeLimit || 0;
    if(tl > 0) {
        let timeLeft = tl;
        document.getElementById('quiz-timer').innerText = `🕒 ${timeLeft}s`;
        if(quizTimerInterval) clearInterval(quizTimerInterval);
        quizTimerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('quiz-timer').innerText = `🕒 ${timeLeft}s`;
            if(timeLeft <= 0) {
                clearInterval(quizTimerInterval);
                window.submitQuiz('TIMEOUT');
            }
        }, 1000);
    } else {
        document.getElementById('quiz-timer').innerText = '';
    }

    document.getElementById('quiz-modal').style.display = 'flex';
};

window.submitQuiz = async opt => {
    if(quizTimerInterval) clearInterval(quizTimerInterval);
    const qS = await get(ref(db, `quests/${activeQuizId}`)); const q = qS.val();
    const att = q.attempts?.[uid] || 0; await update(ref(db, `quests/${activeQuizId}/attempts`), { [uid]: att + 1 });
    const uS = await get(ref(db, `users/${uid}`)); const u = uS.val();
    const currentPP = Number(u.pp) || 0;
    
    if (opt === 'TIMEOUT') {
        await update(ref(db, `users/${uid}`), { pp: Math.max(0, currentPP - q.penaltyPP) }); alert("HẾT GIỜ! BẠN BỊ PHẠT PP!");
    } else if(opt === q.correctOpt) { 
        await update(ref(db, `users/${uid}`), { pp: currentPP + q.rewardPP }); alert("ĐÚNG!"); 
    } else { 
        await update(ref(db, `users/${uid}`), { pp: Math.max(0, currentPP - q.penaltyPP) }); alert("SAI!"); 
    }
    window.closeQuizModal();
};

window.openGrades = async (id, n) => {
    document.getElementById('view-grades-student-name').innerText = n;
    const s = await get(ref(db, `users/${id}/academic`));
    const tb = document.getElementById('admin-view-grades-body'); tb.innerHTML = '';
    if(s.exists()) {
        Object.keys(s.val()).forEach(tk => {
            for(let sk in s.val()[tk]) {
                const m = s.val()[tk][sk];
                tb.innerHTML += `<tr><td>${tk}</td><td>${m.name}</td><td><input type="number" id="b_${sk}" value="${m.bth}" style="width:35px;"></td><td><input type="number" id="g_${sk}" value="${m.gk}" style="width:35px;"></td><td><input type="number" id="c_${sk}" value="${m.ck}" style="width:35px;"></td><td>${m.final}</td><td><button onclick="window.saveG('${id}','${tk}','${sk}')" class="btn-mini add">OK</button></td></tr>`;
            }
        });
    }
    document.getElementById('view-grades-modal').style.display = 'flex';
};
window.saveG = async (u, tk, sk) => {
    const b = parseFloat(document.getElementById(`b_${sk}`).value)||0, g = parseFloat(document.getElementById(`g_${sk}`).value)||0, c = parseFloat(document.getElementById(`c_${sk}`).value)||0;
    const f = Math.round(((b*1+g*2+c*3)/6)*10)/10, gr = f>=8.5?'A':f>=7?'B':f>=5.5?'C':f>=4?'D':'F';
    await update(ref(db, `users/${u}/academic/${tk}/${sk}`), { bth:b, gk:g, ck:c, final:f, grade:gr }); alert("LƯU!");
};
let curSID = null;
window.openSubModal = id => { curSID = id; document.getElementById('subject-modal').style.display = 'flex'; };
window.adminSaveSubject = async () => {
    const y = document.getElementById('subj-year').value, s = document.getElementById('subj-sem').value, n = document.getElementById('subj-name').value;
    const b = parseFloat(document.getElementById('subj-bth').value)||0, g = parseFloat(document.getElementById('subj-gk').value)||0, c = parseFloat(document.getElementById('subj-ck').value)||0;
    const f = Math.round(((b*1+g*2+c*3)/6)*10)/10, gr = f>=8.5?'A':f>=7?'B':f>=5.5?'C':f>=4?'D':'F';
    await update(ref(db, `users/${curSID}/academic/Year${y}_Sem${s}/sub_${Date.now()}`), { name:n, bth:b, gk:g, ck:c, final:f, grade:gr });
    alert("XONG!"); window.closeSubjectModal();
};

window.changeAvatar = () => { const url = prompt("Link ảnh:"); if(url) update(ref(db, `users/${uid}`), { avatar: url }); };
window.changeTeacherName = () => { const n = prompt("Tên mới:"); if(n) update(ref(db, `users/${uid}`), { name: n }); };
window.closeQuizModal = () => {
    if(quizTimerInterval) clearInterval(quizTimerInterval);
    document.getElementById('quiz-modal').style.display = 'none';
}
window.closeViewGradesModal = () => document.getElementById('view-grades-modal').style.display = 'none';
window.closeSubjectModal = () => document.getElementById('subject-modal').style.display = 'none';
window.transferPP = async () => {
    const rid = document.getElementById('transfer-uid').value, amt = parseInt(document.getElementById('transfer-amount').value);
    const mS = await get(ref(db, `users/${uid}`)), rS = await get(ref(db, `users/${rid}`));
    if(!rS.exists() || (Number(mS.val().pp)||0) < amt) return alert("LỖI!");
    await update(ref(db, `users/${uid}`), { pp: (Number(mS.val().pp)||0) - amt }); await update(ref(db, `users/${rid}`), { pp: (Number(rS.val().pp)||0) + amt }); alert("XONG!");
};
window.sendExpelRequest = async () => {
    const t = document.getElementById('expel-uid').value, r = document.getElementById('expel-reason').value;
    await set(ref(db, `messages/msg_${Date.now()}`), { senderUid: uid, senderName: (await get(ref(db, `users/${uid}`))).val().name, targetUid: t, reason: r, status: 'PENDING', adminReply: '' });
    alert("ĐÃ GỬI!");
};

// --- MINIGAMES KHU VỰC CASINO ---
window.rollGacha = async () => {
    const snap = await get(ref(db, `users/${uid}`)); const u = snap.val(); 
    const currentPP = Number(u.pp) || 0;
    if(currentPP < 5000) return alert("BẠN KHÔNG ĐỦ 5,000 PP MUA HỘP MÙ!");
    
    const r = Math.random()*100; let n = currentPP - 5000, m = "TRẮNG TAY! BẠN VỪA MẤT 5,000 PP! 💀";
    if(r > 95) { n += 50000; m = "JACKPOT!!! TRÚNG ĐỘC ĐẮC 50,000 PP! 🎉"; } 
    else if(r > 80) { n += 10000; m = "X2 TÀI SẢN!!! LỜI ĐƯỢC 10,000 PP! 💵"; }
    
    await update(ref(db, `users/${uid}`), { pp: n }); alert(m);
};

window.coinFlip = async (choice) => {
    const bet = parseInt(prompt("Nhập số PP bạn muốn Cược (Đồng Xu):"));
    if(isNaN(bet) || bet <= 0) return;
    
    const snap = await get(ref(db, `users/${uid}`)); 
    const u = snap.val(); 
    const currentPP = Number(u.pp) || 0;
    
    if(currentPP < bet) return alert("BẠN KHÔNG CÓ ĐỦ SỐ PP NÀY ĐỂ CƯỢC!");
    
    const isHeads = Math.random() > 0.5; // true = Sấp, false = Ngửa
    const result = isHeads ? 'SAP' : 'NGUA';
    
    if (choice === result) {
        await update(ref(db, `users/${uid}`), { pp: currentPP + bet });
        alert(`ĐỒNG XU RA MẶT ${result === 'SAP' ? 'SẤP' : 'NGỬA'}!\nBẠN THẮNG GẤP ĐÔI! CỘNG VÀO TÀI KHOẢN +${bet} PP! 🎊`);
    } else {
        await update(ref(db, `users/${uid}`), { pp: currentPP - bet });
        alert(`ĐỒNG XU RA MẶT ${result === 'SAP' ? 'SẤP' : 'NGỬA'}!\nBẠN ĐÃ ĐOÁN SAI. TRỪ ĐI ${bet} PP! 💀`);
    }
};

window.rpsGame = async (playerChoice) => {
    const bet = parseInt(prompt("Nhập số PP bạn muốn Cược (Kéo Búa Bao):"));
    if(isNaN(bet) || bet <= 0) return;
    
    const snap = await get(ref(db, `users/${uid}`));
    const u = snap.val();
    const currentPP = Number(u.pp) || 0;
    
    if(currentPP < bet) return alert("BẠN KHÔNG CÓ ĐỦ SỐ PP NÀY ĐỂ CƯỢC!");

    // Thuật toán Hệ thống tự chọn ngẫu nhiên
    const choices = ['KEO', 'BUA', 'BAO'];
    const sysChoice = choices[Math.floor(Math.random() * 3)];
    
    let result = '';
    if(playerChoice === sysChoice) result = 'DRAW';
    else if(
        (playerChoice === 'KEO' && sysChoice === 'BAO') ||
        (playerChoice === 'BUA' && sysChoice === 'KEO') ||
        (playerChoice === 'BAO' && sysChoice === 'BUA')
    ) result = 'WIN';
    else result = 'LOSE';

    const sysName = sysChoice === 'KEO' ? 'KÉO ✌️' : sysChoice === 'BUA' ? 'BÚA ✊' : 'BAO ✋';

    if(result === 'WIN') {
        await update(ref(db, `users/${uid}`), { pp: currentPP + bet });
        alert(`HỆ THỐNG CHỌN: ${sysName}\nBẠN THẮNG! CỘNG +${bet} PP! 🎉`);
    } else if(result === 'LOSE') {
        await update(ref(db, `users/${uid}`), { pp: currentPP - bet });
        alert(`HỆ THỐNG CHỌN: ${sysName}\nBẠN THUA! BỊ TRỪ -${bet} PP! 💀`);
    } else {
        alert(`HỆ THỐNG CHỌN: ${sysName}\nHÒA! TRẢ LẠI TIỀN CƯỢC CỦA BẠN! 🤝`);
    }
};
