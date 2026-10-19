/**
 * Happy Birthday Interactive Experience
 * Mobile & iPad Optimized | Verlet Physics Cord | Mic Blow Detection
 * Firebase Realtime Database Integration | No UI Admin / Hidden Wishes
 */

// ==========================================================
// 🔑 1. CONFIGURATION (ตั้งค่าเจ้าของวันเกิด & ฐานข้อมูล)
// ==========================================================

// 👉 เปลี่ยนชื่อและวันเกิดของคนพิเศษตรงนี้ได้เลย:
const BIRTHDAY_PERSON = {
  name: 'มะนาว',          // ชื่อเล่นหรือชื่อจริง (เช่น 'มายด์', 'Mind')
  birthday: '2009-10-21'  // วันเกิดจริงในรูปแบบ YYYY-MM-DD (เช่น '2000-10-18')
};

// 👉 ข้อมูลเชื่อมต่อ Firebase Realtime Database (สำหรับเก็บคำขอพร)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDtNoMFxZESHv885aCyZVtejsT1m-eeldQ",
  authDomain: "birthday-surprise-614db.firebaseapp.com",
  databaseURL: "https://birthday-surprise-614db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "birthday-surprise-614db",
  storageBucket: "birthday-surprise-614db.firebasestorage.app",
  messagingSenderId: "780212968787",
  appId: "1:780212968787:web:6e96e5f39fd540f72695a6",
  measurementId: "G-XZW9R9D1LC"
};

// เริ่มต้นเชื่อมต่อกับ Firebase Realtime Database
let db = null;
if (
  typeof firebase !== 'undefined' &&
  typeof FIREBASE_CONFIG !== 'undefined' &&
  FIREBASE_CONFIG.projectId &&
  !FIREBASE_CONFIG.projectId.includes('YOUR_PROJECT_ID')
) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    console.log('✅ Firebase Realtime Database connected ready to store wishes.');
  } catch (err) {
    console.warn('⚠️ Firebase initialization failed:', err);
  }
}

// ข้อมูลของผู้ที่กำลังใช้งาน
let activeUser = {
  name: '',
  birthday: ''
};

let audioCtx = null;
let isCandleBlown = false;
let micStream = null;
let micAnalyser = null;
let micAnimationId = null;

// ==========================================================
// 2. SYNTHETIC AUDIO (เสียงเอฟเฟกต์สร้างสด ไม่ต้องพึ่งพาไฟล์ mp3)
// ==========================================================
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// เสียงคลิกสวิตช์ไฟ
function playSwitchSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(130, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.09);
}

// เสียงเกียร์สปริงดึงตึง (Ratchet tension sound) ไต่ระดับตามระยะดึง
function playRatchetTick(progress) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // ความถี่ของเสียงคลิกจะสูงขึ้นเรื่อยๆ ตามความตึงของสาย (220Hz -> 670Hz)
    const baseFreq = 220 + Math.pow(progress, 1.3) * 450;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, ctx.currentTime + 0.035);

    // ความดังไต่ระดับขึ้นเบาๆ
    const vol = 0.05 + progress * 0.15;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
}

// คลื่นเสียงความถี่ต่ำพิเศษ (Sub-bass Physical Rumble 50Hz) กระพือลำโพงมือถือให้สะเทือนถึงมือ
function playSubBassPulse(progress) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // ความถี่ต่ำ 50Hz - 80Hz ทำให้มอเตอร์/กรวยลำโพงมือถือสั่นสะเทือนส่งถึงมือ
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(50 + progress * 30, ctx.currentTime);

    const vol = 0.3 + progress * 0.6;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

// เสียงลมเป่าเทียน
function playBlowSound() {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 0.45;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / bufferSize));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(380, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.45);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.85, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
}

// เสียงแกะตราประทับครั่ง
function playSealSound() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(380, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.16);

  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.17);
}

// เสียงกระดิ่งฉลองสุขสันต์
function playChime() {
  const ctx = getAudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + idx * 0.09;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.28, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.6);
  });
}

// ==========================================================
// 3. STAGE SWITCHING
// ==========================================================
function switchStage(fromId, toId) {
  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);

  if (fromEl) {
    fromEl.classList.remove('active');
    setTimeout(() => {
      fromEl.classList.add('hidden');
      if (toEl) {
        toEl.classList.remove('hidden');
        void toEl.offsetWidth; // Force layout reflow
        toEl.classList.add('active');

        if (toId === 'stage-dark') {
          if (!ropePhysics && ropeCanvas) {
            ropePhysics = new RopePhysics(ropeCanvas);
          }
          if (ropePhysics) ropePhysics.start();
        }
      }
    }, 380);
  } else if (toEl) {
    toEl.classList.remove('hidden');
    void toEl.offsetWidth;
    toEl.classList.add('active');

    if (toId === 'stage-dark') {
      if (!ropePhysics && ropeCanvas) {
        ropePhysics = new RopePhysics(ropeCanvas);
      }
      if (ropePhysics) ropePhysics.start();
    }
  }
}

// ==========================================================
// 4. STAGE 0: SMART & ROBUST LOGIN LOGIC
// ==========================================================
const loginForm = document.getElementById('login-form');
const loginNameInput = document.getElementById('login-name');
const loginDobInput = document.getElementById('login-birthday');
const loginErrorEl = document.getElementById('login-error');

// ตัวช่วยแปลงและตรวจสอบวันที่ (รองรับการพิมพ์ทั้ง 21/10/2552, 21/10/2009, 21-10, 21/10 หรือ 21 ตุลาคม)
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  let str = String(dateStr).trim();

  // 1. ตรวจจับชื่อเดือนภาษาไทย เช่น '21 ตุลาคม 2552' หรือ '21 ต.ค.'
  const thaiMonths = {
    'มกราคม': 1, 'มกรา': 1, 'ม.ค.': 1, 'ม.ค': 1,
    'กุมภาพันธ์': 2, 'กุมภา': 2, 'ก.พ.': 2, 'ก.พ': 2,
    'มีนาคม': 3, 'มีนา': 3, 'มี.ค.': 3, 'มี.ค': 3,
    'เมษายน': 4, 'เมษา': 4, 'เม.ย.': 4, 'เม.ย': 4,
    'พฤษภาคม': 5, 'พฤษภา': 5, 'พ.ค.': 5, 'พ.ค': 5,
    'มิถุนายน': 6, 'มิถุนา': 6, 'มิ.ย.': 6, 'มิ.ย': 6,
    'กรกฎาคม': 7, 'กรกฎา': 7, 'ก.ค.': 7, 'ก.ค': 7,
    'สิงหาคม': 8, 'สิงหา': 8, 'ส.ค.': 8, 'ส.ค': 8,
    'กันยายน': 9, 'กันยา': 9, 'ก.ย.': 9, 'ก.ย': 9,
    'ตุลาคม': 10, 'ตุลา': 10, 'ต.ค.': 10, 'ต.ค': 10,
    'พฤศจิกายน': 11, 'พฤศจิกา': 11, 'พ.ย.': 11, 'พ.ย': 11,
    'ธันวาคม': 12, 'ธันวา': 12, 'ธ.ค.': 12, 'ธ.ค': 12
  };

  let foundMonth = null;
  for (const [mName, mNum] of Object.entries(thaiMonths)) {
    if (str.includes(mName)) {
      foundMonth = mNum;
      str = str.replace(mName, ' ').trim();
      break;
    }
  }

  if (foundMonth !== null) {
    const nums = str.match(/\d+/g);
    if (nums && nums.length >= 1) {
      const day = parseInt(nums[0], 10);
      let year = nums.length >= 2 ? parseInt(nums[1], 10) : null;
      if (year && year > 2400) year -= 543;
      return {
        day,
        month: foundMonth,
        year,
        mmdd: `${String(foundMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      };
    }
  }

  // 2. แยกตัวเลขล้วน (เช่น '21/10/2552', '21-10-2009', '21.10.2552', '21 10')
  const cleanStr = str.replace(/[^\d]/g, ' ');
  const nums = cleanStr.trim().split(/\s+/).filter(Boolean).map(n => parseInt(n, 10));

  if (nums.length === 3) {
    let day, month, year;
    // รูปแบบปีขึ้นก่อน YYYY-MM-DD
    if (nums[0] > 1000) {
      year = nums[0];
      month = nums[1];
      day = nums[2];
    } else {
      // รูปแบบ DD/MM/YYYY
      day = nums[0];
      month = nums[1];
      year = nums[2];
    }
    if (year > 2400) year -= 543;
    return {
      day,
      month,
      year,
      mmdd: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  } else if (nums.length === 2) {
    // แค่วันกับเดือน เช่น 21/10
    const day = nums[0];
    const month = nums[1];
    return {
      day,
      month,
      year: null,
      mmdd: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  } else if (nums.length === 1 && String(nums[0]).length >= 4) {
    // พิมพ์ติดกัน เช่น '21102552' หรือ '21102009' หรือ '2110'
    const s = String(nums[0]);
    const day = parseInt(s.slice(0, 2), 10);
    const month = parseInt(s.slice(2, 4), 10);
    let year = null;
    if (s.length >= 8) {
      year = parseInt(s.slice(4, 8), 10);
      if (year > 2400) year -= 543;
    }
    return {
      day,
      month,
      year,
      mmdd: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }

  return null;
}

function checkDateMatch(entered, target) {
  const pEntered = parseDateParts(entered);
  const pTarget = parseDateParts(target);
  if (!pEntered || !pTarget) return false;

  // ตรวจสอบวันและเดือนเกิด (เช่น วันที่ 21 เดือน 10)
  const isMonthDayMatch = pEntered.day === pTarget.day && pEntered.month === pTarget.month;

  if (isMonthDayMatch) {
    // ถ้าทั้งคู่ระบุปี ให้ตรวจสอบปีด้วย (หลังแปลง พ.ศ./ค.ศ. แล้ว)
    if (pEntered.year && pTarget.year) {
      return pEntered.year === pTarget.year;
    }
    // ถ้าฝั่งใดฝั่งหนึ่งไม่ได้ระบุปี (เช่น พิมพ์แค่ 21/10) ให้ผ่านได้ถ้าวัน-เดือนตรง
    return true;
  }

  return false;
}

function checkNameMatch(entered, target) {
  if (!entered) return false;
  const cleanEntered = entered.trim().toLowerCase().replace(/\s+/g, '');
  
  const targets = Array.isArray(target) ? target : [target];
  return targets.some(t => {
    if (!t) return false;
    const cleanTarget = String(t).trim().toLowerCase().replace(/\s+/g, '');
    return (
      cleanEntered === cleanTarget ||
      cleanEntered.includes(cleanTarget) ||
      cleanTarget.includes(cleanEntered)
    );
  });
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  getAudioContext();
  const enteredName = loginNameInput.value.trim();
  const enteredDob = loginDobInput.value;

  console.log('🔍 [Login Check]', {
    enteredName,
    enteredDob,
    targetConfig: BIRTHDAY_PERSON
  });

  const isNameMatch = checkNameMatch(enteredName, BIRTHDAY_PERSON.name || BIRTHDAY_PERSON.names);
  const isDobMatch = checkDateMatch(enteredDob, BIRTHDAY_PERSON.birthday);

  if (isNameMatch && isDobMatch) {
    activeUser.name = enteredName;
    activeUser.birthday = enteredDob;

    // อัปเดตชื่อในหน้าต่างๆ
    const displayNameEl = document.getElementById('display-name');
    if (displayNameEl) displayNameEl.textContent = activeUser.name;

    const letterNameEl = document.getElementById('letter-recipient-name');
    if (letterNameEl) letterNameEl.textContent = activeUser.name;

    loginErrorEl.classList.add('hidden');

    // สลับไปยังด่านที่ 1 (ห้องมืด)
    switchStage('stage-login', 'stage-dark');
  } else {
    // แจ้งเตือนอย่างเจาะจงว่าชื่อหรือวันเกิดที่ไม่ตรง
    if (!isNameMatch && !isDobMatch) {
      loginErrorEl.textContent = '❌ ทั้งชื่อและวันเกิดไม่ตรงกับที่ตั้งไว้ในระบบเลยน้า! ลองตรวจดูอีกทีนะ 😉';
    } else if (!isNameMatch) {
      loginErrorEl.textContent = '❌ ชื่อไม่ตรงกับข้อมูลในระบบน้า (ลองพิมพ์ชื่อเล่นดูนะ)';
    } else {
      loginErrorEl.textContent = '❌ วันเกิดไม่ตรงกับข้อมูลในระบบน้า (ลองตรวจดู วัน/เดือน/ปีเกิด อีกรอบสิ)';
    }
    loginErrorEl.classList.remove('hidden');
  }
});

// ==========================================================
// 5. STAGE 1: DARK ROOM & PHYSICS ROPE SIMULATION
// ==========================================================
const ropeCanvas = document.getElementById('rope-canvas');
const physicsHint = document.getElementById('physics-hint');
let isLightTurnedOn = false;
let ropeAnimationId = null;

class RopePhysics {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.points = [];
    this.numSegments = 16;
    this.baseSegmentLength = 16;
    this.segmentLength = 16;
    this.gravity = 0.52;
    this.friction = 0.96;
    this.isDragging = false;
    this.dragPointerId = null;
    this.anchorX = 0;
    this.anchorY = 0;
    this.naturalRestY = 0;
    this.targetTriggerY = 0;
    this.pullThreshold = 350; // ระยะดึงเพื่อให้ไฟเปิด (px)
    this.lastVibeTime = 0;
    this.lastVibeStretch = 0;

    this.resize();
    this.initPoints();
    this.bindEvents();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.anchorX = this.canvas.width / 2;
    this.anchorY = 0;
    
    this.numSegments = 16;
    this.baseSegmentLength = Math.max(12, Math.min(18, this.canvas.height * 0.024));
    this.segmentLength = this.baseSegmentLength;
    this.naturalRestY = this.anchorY + this.numSegments * this.baseSegmentLength;
    
    // ดึงได้ยาวลงมาเกือบถึงขอบล่างของหน้าจอ (ประมาณ 82% ของความสูงหน้าจอ)
    this.targetTriggerY = this.canvas.height * 0.82;
    this.pullThreshold = Math.max(220, this.targetTriggerY - this.naturalRestY);
  }

  initPoints() {
    this.points = [];
    for (let i = 0; i <= this.numSegments; i++) {
      const y = this.anchorY + i * this.segmentLength;
      this.points.push({
        x: this.anchorX,
        y: y,
        oldX: this.anchorX,
        oldY: y,
        pinned: i === 0
      });
    }
  }

  // ระบบสั่นและสร้างแรงต้าน (Progressive Haptic Feedback) ยิ่งดึงยาว ยิ่งสั่นแรงและถี่ขึ้น
  applyTensionHaptics(stretch) {
    const progress = Math.min(1, Math.max(0, stretch / this.pullThreshold));
    const now = performance.now();

    // ยิ่งดึงลึก จังหวะการสั่นจะยิ่งถี่ขึ้น (จากทุกๆ 140ms ลงไปถึง 35ms)
    const interval = 140 - (progress * 105);
    const distDelta = Math.abs(stretch - this.lastVibeStretch);

    if (now - this.lastVibeTime > interval || distDelta > (15 - progress * 10)) {
      this.lastVibeTime = now;
      this.lastVibeStretch = stretch;

      // 1. สั่นมือถือ: ยิ่งดึงยาว ยิ่งสั่นแรงและนานขึ้น (จาก 20ms ไต่ระดับไปถึง 80ms)
      if (navigator.vibrate) {
        const vibeDuration = Math.round(20 + Math.pow(progress, 1.3) * 60);
        try {
          navigator.vibrate(vibeDuration);
        } catch (err) {}
      }

      // 2. เสียงเกียร์สปริงดึงตึง (Ratchet sound)
      playRatchetTick(progress);

      // 3. คลื่นความถี่ต่ำสั่นสะเทือนลำโพงมือถือ (Sub-bass Physical Rumble)
      playSubBassPulse(progress);

      // 4. จอสั่นระริกตามแรงดึง (Screen micro-tremor เมื่อดึงเกิน 50%)
      if (progress > 0.45) {
        const shakeIntensity = (progress - 0.45) * 5.5;
        const rx = (Math.random() - 0.5) * shakeIntensity;
        const ry = (Math.random() - 0.5) * shakeIntensity;
        document.body.style.transform = `translate(${rx}px, ${ry}px)`;
      } else {
        document.body.style.transform = '';
      }
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      if (!this.isDragging) this.initPoints();
    });

    const onPointerDown = (e) => {
      if (isLightTurnedOn) return;
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const handle = this.points[this.numSegments];
      const dist = Math.hypot(px - handle.x, py - handle.y);

      // ตรวจจับการแตะบริเวณตุ้มกระดิ่งหรือสายเชือก
      if (dist < 85 || (Math.abs(px - this.anchorX) < 65 && py < handle.y + 45)) {
        this.isDragging = true;
        this.dragPointerId = e.pointerId;
        this.canvas.setPointerCapture(e.pointerId);
        handle.x = px;
        handle.y = py;
        handle.oldX = px;
        handle.oldY = py;

        // ปลดล็อกระบบเสียงและส่งสัมผัสแตะเริ่มแรก
        getAudioContext();
        if (navigator.vibrate) {
          try { navigator.vibrate(30); } catch (e) {}
        }
        playSubBassPulse(0.2);

        if (physicsHint) physicsHint.style.opacity = '0.3';
      }
    };

    const onPointerMove = (e) => {
      if (!this.isDragging || isLightTurnedOn) return;
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const handle = this.points[this.numSegments];
      handle.x = px;
      // ให้ลากลงมาได้ถึงเกือบสุดขอบจอด้านล่าง (เว้นระยะขอบล่าง 30px)
      const maxY = this.canvas.height - 30;
      handle.y = Math.min(maxY, Math.max(this.anchorY + 40, py));

      const stretch = handle.y - this.naturalRestY;

      // ระบบสร้างการสั่นและแรงต้านแบบ Dynamic Haptic Feedback
      if (stretch > 5) {
        this.applyTensionHaptics(stretch);
      } else {
        document.body.style.transform = '';
      }

      // เมื่อดึงลงมาถึงระยะเกือบสุดจอ (82% ของจอ หรือเกิน pullThreshold) ให้สวิตช์ทำงานทันที
      if (handle.y >= this.targetTriggerY || stretch >= this.pullThreshold) {
        this.isDragging = false;
        document.body.style.transform = '';
        triggerLightSwitch();
      }
    };

    const onPointerUp = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.dragPointerId = null;
      document.body.style.transform = '';
      if (physicsHint) physicsHint.style.opacity = '1';
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    this.canvas.addEventListener('pointerup', onPointerUp);
    this.canvas.addEventListener('pointercancel', onPointerUp);
  }

  update() {
    // คำนวณความยาวข้อต่อแบบไดนามิก เพื่อให้ลูกปัดทุกเม็ดกระจายตัวยืดสม่ำเสมอตามระยะลาก
    let currentSegLen = this.baseSegmentLength;
    if (this.isDragging) {
      const handle = this.points[this.numSegments];
      const totalDist = Math.hypot(handle.x - this.anchorX, handle.y - this.anchorY);
      currentSegLen = Math.max(this.baseSegmentLength, totalDist / this.numSegments);
    }

    for (let i = 0; i <= this.numSegments; i++) {
      const p = this.points[i];
      if (p.pinned) continue;
      if (i === this.numSegments && this.isDragging) continue;

      const vx = (p.x - p.oldX) * this.friction;
      const vy = (p.y - p.oldY) * this.friction;

      p.oldX = p.x;
      p.oldY = p.y;

      p.x += vx;
      p.y += vy + this.gravity;
    }

    // Constraint relaxation (8 passes for smooth stability)
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 0; i < this.numSegments; i++) {
        const p1 = this.points[i];
        const p2 = this.points[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const diff = (dist - currentSegLen) / dist;

        const offsetX = dx * diff * 0.5;
        const offsetY = dy * diff * 0.5;

        if (!p1.pinned) {
          p1.x += offsetX;
          p1.y += offsetY;
        }
        if (!p2.pinned && !(i + 1 === this.numSegments && this.isDragging)) {
          p2.x -= offsetX;
          p2.y -= offsetY;
        }
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // วาดสายโซ่ลูกปัดโลหะสีเงิน
    this.ctx.beginPath();
    this.ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i <= this.numSegments; i++) {
      const xc = (this.points[i - 1].x + this.points[i].x) / 2;
      const yc = (this.points[i - 1].y + this.points[i].y) / 2;
      this.ctx.quadraticCurveTo(this.points[i - 1].x, this.points[i - 1].y, xc, yc);
    }
    this.ctx.lineTo(this.points[this.numSegments].x, this.points[this.numSegments].y);
    this.ctx.strokeStyle = '#d1d5db';
    this.ctx.lineWidth = 3.5;
    this.ctx.stroke();

    for (let i = 1; i <= this.numSegments; i++) {
      const p = this.points[i];
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.fill();
    }

    // วาดตุ้มดึงระฆังสีทองนวลพร้อมแสงเรืองรองที่ทวีความสว่างขึ้นตามแรงดึง
    const knob = this.points[this.numSegments];
    const stretch = Math.max(0, knob.y - this.naturalRestY);
    const progress = Math.min(1, stretch / this.pullThreshold);

    const glowRadius = 45 + progress * 35;
    const glowAlpha = 0.65 + progress * 0.35;
    const glow = this.ctx.createRadialGradient(knob.x, knob.y + 16, 5, knob.x, knob.y + 16, glowRadius);
    glow.addColorStop(0, `rgba(255, 240, 180, ${glowAlpha})`);
    glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(knob.x, knob.y + 16, glowRadius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.save();
    this.ctx.translate(knob.x, knob.y);

    this.ctx.beginPath();
    this.ctx.arc(0, 4, 6, 0, Math.PI * 2);
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.roundRect(-13, 8, 26, 38, [8, 8, 14, 14]);
    const knobGrad = this.ctx.createLinearGradient(-13, 8, 13, 46);
    knobGrad.addColorStop(0, '#ffffff');
    knobGrad.addColorStop(0.3, '#f1f5f9');
    knobGrad.addColorStop(1, '#cbd5e1');
    this.ctx.fillStyle = knobGrad;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 4;
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';

    this.ctx.beginPath();
    this.ctx.ellipse(-3, 24, 2, 10, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.fill();

    this.ctx.restore();
  }

  loop() {
    if (isLightTurnedOn) return;
    this.update();
    this.draw();
    ropeAnimationId = requestAnimationFrame(() => this.loop());
  }

  start() {
    if (!ropeAnimationId) {
      this.resize();
      this.initPoints();
      this.loop();
    }
  }

  stop() {
    if (ropeAnimationId) {
      cancelAnimationFrame(ropeAnimationId);
      ropeAnimationId = null;
    }
  }
}

let ropePhysics = null;

function triggerLightSwitch() {
  if (isLightTurnedOn) return;
  isLightTurnedOn = true;

  if (ropePhysics) ropePhysics.stop();

  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 80]);
  }

  playSwitchSound();

  // แฟลชหน้าจอสว่างวาบ
  document.body.style.backgroundColor = '#ffffff';

  setTimeout(() => {
    switchStage('stage-dark', 'stage-cake');
    document.body.style.backgroundColor = '';
  }, 240);
}

// ==========================================================
// 6. STAGE 2: MAKE A WISH & BLOW CANDLE
// ==========================================================
const candleFlame = document.getElementById('candle-flame');
const candleSmoke = document.getElementById('candle-smoke');
const wishInput = document.getElementById('wish-input');
const btnClickBlow = document.getElementById('btn-click-blow');
const btnMic = document.getElementById('btn-mic');
const micStatusText = document.getElementById('mic-status-text');
const micVisualizer = document.getElementById('mic-visualizer');
const meterFill = document.getElementById('meter-fill');
const wishSection = document.getElementById('wish-section');
const blowSuccessMsg = document.getElementById('blow-success');
const btnToLetter = document.getElementById('btn-to-letter');

function triggerCandleExtinguish() {
  if (isCandleBlown) return;
  isCandleBlown = true;

  playBlowSound();
  stopMicListening();

  // ดับเปลวไฟ, หรี่แสงเค้ก และปล่อยควัน
  if (candleFlame) candleFlame.classList.add('extinguished');
  const flameAura = document.getElementById('flame-glow-aura');
  if (flameAura) flameAura.classList.add('extinguished');
  const cakeHalo = document.getElementById('cake-halo');
  if (cakeHalo) cakeHalo.classList.add('dimmed');
  const realCakeImg = document.getElementById('real-cake-img');
  if (realCakeImg) realCakeImg.classList.add('extinguished');
  if (candleSmoke) candleSmoke.classList.remove('hidden');

  // สั่นและยิงพลุกระดาษ Confetti
  if (navigator.vibrate) {
    navigator.vibrate([60, 40, 100]);
  }

  if (window.confetti) {
    window.confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    setTimeout(() => {
      window.confetti({
        particleCount: 80,
        angle: 60,
        spread: 60,
        origin: { x: 0 }
      });
      window.confetti({
        particleCount: 80,
        angle: 120,
        spread: 60,
        origin: { x: 1 }
      });
    }, 300);
  }

  setTimeout(playChime, 400);

  // บันทึกคำขอพรลง Database ทันที
  saveWish(wishInput.value.trim());

  setTimeout(() => {
    wishSection.style.display = 'none';
    blowSuccessMsg.classList.remove('hidden');
  }, 900);
}

// กดปุ่มเป่าเทียน
btnClickBlow.addEventListener('click', triggerCandleExtinguish);

// เป่าเทียนผ่านไมโครโฟน
btnMic.addEventListener('click', async () => {
  if (isCandleBlown) return;

  if (micStream) {
    stopMicListening();
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    btnMic.classList.add('listening');
    micStatusText.textContent = '🌬️ กำลังฟังเสียงลม... ลองเป่าใส่ไมค์เลย!';
    micVisualizer.classList.remove('hidden');

    const ctx = getAudioContext();
    const source = ctx.createMediaStreamSource(micStream);
    micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 512;
    source.connect(micAnalyser);

    const bufferLength = micAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let consecutiveBlowCount = 0;

    function detectBlow() {
      if (isCandleBlown) return;

      micAnalyser.getByteFrequencyData(dataArray);

      // ตรวจจับย่านความถี่ต่ำของลมเป่า (20Hz - 300Hz)
      let lowFreqSum = 0;
      const lowBinCount = Math.floor(bufferLength * 0.15);
      for (let i = 0; i < lowBinCount; i++) {
        lowFreqSum += dataArray[i];
      }
      const avgLow = lowFreqSum / lowBinCount;

      const percent = Math.min(100, Math.round((avgLow / 150) * 100));
      meterFill.style.width = percent + '%';

      if (avgLow > 75) {
        consecutiveBlowCount++;
        if (consecutiveBlowCount >= 3) {
          triggerCandleExtinguish();
          return;
        }
      } else {
        consecutiveBlowCount = Math.max(0, consecutiveBlowCount - 1);
      }

      micAnimationId = requestAnimationFrame(detectBlow);
    }

    detectBlow();
  } catch (err) {
    console.warn('Microphone access denied:', err);
    alert('ไม่สามารถเปิดไมค์ได้ (อาจต้องกดอนุญาตสิทธิ์ไมโครโฟน) แต่สามารถแตะปุ่ม "กดเป่าเทียนตรงนี้" แทนได้นะ!');
    stopMicListening();
  }
});

function stopMicListening() {
  if (micAnimationId) {
    cancelAnimationFrame(micAnimationId);
    micAnimationId = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  btnMic.classList.remove('listening');
  micStatusText.textContent = 'เปิดไมค์แล้วเป่าลมใส่หน้าจอ';
  micVisualizer.classList.add('hidden');
}

btnToLetter.addEventListener('click', () => {
  switchStage('stage-cake', 'stage-letter');
});

// ==========================================================
// 7. SAVE WISH TO DATABASE (SUPABASE)
// ==========================================================
async function saveWish(wishText) {
  const wishEntry = {
    name: activeUser.name || BIRTHDAY_PERSON.name,
    birthday: activeUser.birthday || BIRTHDAY_PERSON.birthday,
    wish: wishText || '(ไม่ได้พิมพ์ข้อความอธิษฐาน)',
    created_at: new Date().toISOString()
  };

  console.log('✨ [WISH CAPTURED] กำลังบันทึกคำขอพร:', wishEntry);

  // 1. บันทึกลง Firebase Realtime Database (ถ้าใส่ Firebase Config แล้ว)
  if (db) {
    try {
      const wishesRef = db.ref('birthday_wishes');
      const newWishRef = wishesRef.push();
      await newWishRef.set({
        name: wishEntry.name,
        birthday: wishEntry.birthday,
        wish: wishEntry.wish,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        local_time: new Date().toLocaleString('th-TH')
      });
      console.log('🎉 [REALTIME DB SUCCESS] คำขอพรถูกบันทึกลง Firebase Realtime Database เรียบร้อยแล้ว!');
    } catch (err) {
      console.error('❌ Firebase Realtime Database save error:', err);
    }
  } else {
    console.log('ℹ️ Firebase ยังไม่ได้ตั้งค่า Config (กำลังเก็บเป็น Local Backup สำรอง)');
  }

  // 2. สำรองข้อมูลลงใน localStorage ของเครื่องผู้ใช้แบบเงียบๆ ป้องกันข้อมูลสูญหาย
  try {
    const backupKey = 'hbd_backup_wishes';
    const list = JSON.parse(localStorage.getItem(backupKey) || '[]');
    list.unshift({ ...wishEntry, local_time: new Date().toLocaleString('th-TH') });
    localStorage.setItem(backupKey, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage backup failed:', e);
  }
}

// ==========================================================
// 8. STAGE 3: WAX SEAL ENVELOPE, CENTERED LETTER & POLAROIDS
// ==========================================================
const envelope = document.getElementById('envelope');
const waxSeal = document.getElementById('wax-seal');
const envelopeView = document.getElementById('envelope-view');
const openedLetterView = document.getElementById('opened-letter-view');
const polaroidItems = document.querySelectorAll('.polaroid-item');

const photoModal = document.getElementById('photo-modal');
const photoModalImg = document.getElementById('photo-modal-img');
const photoModalCaption = document.getElementById('photo-modal-caption');
const photoModalClose = document.getElementById('photo-modal-close');

let isEnvelopeOpen = false;

waxSeal.addEventListener('click', () => {
  if (isEnvelopeOpen) return;
  isEnvelopeOpen = true;

  if (navigator.vibrate) {
    navigator.vibrate([40, 20]);
  }

  playSealSound();
  waxSeal.classList.add('broken');

  // คลี่ซองจดหมายออก
  setTimeout(() => {
    envelope.classList.add('open');

    // เลื่อนซองจดหมายจางไป แล้วเปิดกระดาษจดหมายที่จัดกึ่งกลาง
    setTimeout(() => {
      envelopeView.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      envelopeView.style.opacity = '0';
      envelopeView.style.transform = 'scale(0.92)';

      setTimeout(() => {
        envelopeView.classList.add('hidden');
        openedLetterView.classList.remove('hidden');
        setTimeout(initScratchCard, 120);

        if (window.confetti) {
          window.confetti({
            particleCount: 55,
            spread: 60,
            origin: { y: 0.4 }
          });
        }
      }, 350);
    }, 600);
  }, 220);
});

// กดที่รูปโพลารอยด์เพื่อดูรูปขนาดใหญ่ (Tap to Zoom Lightbox)
polaroidItems.forEach((item) => {
  item.addEventListener('click', () => {
    const img = item.querySelector('img');
    const caption = item.dataset.caption || item.querySelector('.polaroid-caption')?.textContent;

    if (img && photoModal) {
      photoModalImg.src = img.src;
      photoModalCaption.textContent = caption || '';
      photoModal.classList.remove('hidden');

      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  });
});

if (photoModalClose) {
  photoModalClose.addEventListener('click', () => {
    photoModal.classList.add('hidden');
  });
}

if (photoModal) {
  photoModal.addEventListener('click', (e) => {
    if (e.target === photoModal) {
      photoModal.classList.add('hidden');
    }
  });
}

// ใส่วันที่ปัจจุบันในกระดาษจดหมาย
try {
  const now = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const dateEl = document.getElementById('letter-current-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('th-TH', options);
  }
} catch (e) {}

// ==========================================================
// 9. STAGE 3: SCRATCH CARD GIFT VOUCHER LOGIC
// ==========================================================
let isScratchCardRevealed = false;
let isScratchEventsBound = false;
let isScratching = false;
let scratchLastPos = null;
let scratchMoveCount = 0;

function initScratchCard() {
  const canvas = document.getElementById('scratch-canvas');
  const card = document.getElementById('scratch-card');
  const form = document.getElementById('gift-claim-form');
  const input = document.getElementById('gift-wish-input');
  const successEl = document.getElementById('gift-claim-success');

  if (!canvas || !card) return;

  const rect = card.getBoundingClientRect();
  const width = Math.max(300, Math.floor(rect.width));
  const height = Math.max(220, Math.floor(rect.height));

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. วาดแผ่นฟอยล์ทองคำวิบวับ (Golden Metallic Foil)
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#f59e0b');
  grad.addColorStop(0.2, '#fde047');
  grad.addColorStop(0.4, '#d97706');
  grad.addColorStop(0.6, '#fef08a');
  grad.addColorStop(0.8, '#b45309');
  grad.addColorStop(1, '#f59e0b');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // วาดประกายดาวระยิบระยับบนแผ่นทอง
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < 30; i++) {
    const rx = (i * 41) % width;
    const ry = (i * 53) % height;
    ctx.beginPath();
    ctx.arc(rx, ry, (i % 3) + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // เส้นประขอบการ์ด
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(10, 10, width - 20, height - 20);
  ctx.restore();

  // ข้อความบอกให้ขูด
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.font = '32px sans-serif';
  ctx.fillText('🪙', width / 2, height / 2 - 28);

  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 18px "Prompt", sans-serif';
  ctx.fillText('ใช้นิ้วขูดตรงนี้เพื่อเปิดของขวัญ', width / 2, height / 2 + 10);

  ctx.fillStyle = '#92400e';
  ctx.font = '13px "Prompt", sans-serif';
  ctx.fillText('✨ มีสิทธิ์พิเศษซ่อนอยู่ข้างหลัง ✨', width / 2, height / 2 + 34);
  ctx.restore();

  function getPos(e) {
    const cRect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - cRect.left,
      y: e.clientY - cRect.top
    };
  }

  function scratch(pos) {
    if (isScratchCardRevealed) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 42;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (scratchLastPos) {
      ctx.moveTo(scratchLastPos.x, scratchLastPos.y);
      ctx.lineTo(pos.x, pos.y);
    } else {
      ctx.arc(pos.x, pos.y, 21, 0, Math.PI * 2);
    }
    ctx.stroke();

    scratchLastPos = pos;
    scratchMoveCount++;

    if (navigator.vibrate && scratchMoveCount % 4 === 0) {
      try { navigator.vibrate(12); } catch (e) {}
    }

    if (scratchMoveCount % 6 === 0) {
      checkScratchPercentage();
    }
  }

  function checkScratchPercentage() {
    if (isScratchCardRevealed) return;

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const pixels = imgData.data;
      const totalSampled = pixels.length / 16;
      let transparentCount = 0;

      for (let i = 3; i < pixels.length; i += 16) {
        if (pixels[i] === 0) {
          transparentCount++;
        }
      }

      const percent = (transparentCount / totalSampled) * 100;

      if (percent >= 38) {
        revealScratchCard();
      }
    } catch (e) {}
  }

  function revealScratchCard() {
    if (isScratchCardRevealed) return;
    isScratchCardRevealed = true;

    canvas.style.transition = 'opacity 0.6s ease';
    canvas.style.opacity = '0';

    setTimeout(() => {
      canvas.style.display = 'none';
    }, 600);

    if (window.confetti) {
      window.confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.7 }
      });
    }

    playChime();
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 80]);
    }
  }

  if (!isScratchEventsBound) {
    isScratchEventsBound = true;

    canvas.addEventListener('pointerdown', (e) => {
      isScratching = true;
      canvas.setPointerCapture(e.pointerId);
      scratchLastPos = getPos(e);
      scratch(scratchLastPos);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isScratching) return;
      scratch(getPos(e));
    });

    const onPointerStop = () => {
      isScratching = false;
      scratchLastPos = null;
    };

    canvas.addEventListener('pointerup', onPointerStop);
    canvas.addEventListener('pointercancel', onPointerStop);

    // Form submit for gift voucher claim
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const giftWishText = input.value.trim();
        if (!giftWishText) return;

        const submitBtn = document.getElementById('btn-submit-gift');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>กำลังส่งคำขอ... ⏳</span>';
        }

        const giftEntry = {
          name: activeUser.name || BIRTHDAY_PERSON.name,
          birthday: activeUser.birthday || BIRTHDAY_PERSON.birthday,
          gift_wish: giftWishText,
          created_at: new Date().toISOString()
        };

        console.log('🎁 [GIFT CLAIMED]', giftEntry);

        // 1. บันทึกลง Firebase Realtime Database ใน collection 'gift_claims'
        if (db) {
          try {
            const claimsRef = db.ref('gift_claims');
            const newClaimRef = claimsRef.push();
            await newClaimRef.set({
              name: giftEntry.name,
              birthday: giftEntry.birthday,
              gift_wish: giftEntry.gift_wish,
              timestamp: firebase.database.ServerValue.TIMESTAMP,
              local_time: new Date().toLocaleString('th-TH')
            });
            console.log('🎉 [FIREBASE] บันทึกคำขอของขวัญลง Firebase Realtime Database สำเร็จ!');
          } catch (err) {
            console.error('❌ Firebase gift save error:', err);
          }
        }

        // 2. สำรองลง LocalStorage
        try {
          const list = JSON.parse(localStorage.getItem('hbd_backup_gifts') || '[]');
          list.unshift({ ...giftEntry, local_time: new Date().toLocaleString('th-TH') });
          localStorage.setItem('hbd_backup_gifts', JSON.stringify(list));
        } catch (err) {}

        // 3. แสดงข้อความสำเร็จ
        form.classList.add('hidden');
        if (successEl) successEl.classList.remove('hidden');

        if (window.confetti) {
          window.confetti({
            particleCount: 100,
            spread: 85,
            origin: { y: 0.6 }
          });
        }
        playChime();
      });
    }
  }
}
