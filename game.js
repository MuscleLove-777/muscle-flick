(() => {
    'use strict';

    // ===== CONFIG =====
    const TOTAL_IMAGES = 10;
    const SWIPE_THRESHOLD = 80;
    const FLY_DISTANCE = 1500;
    const IMAGE_PATH = 'images/img';

    // ===== STATE =====
    let currentIndex = 0;
    let likedImages = [];
    let images = [];
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isAnimating = false;

    // ===== DOM =====
    const screens = {
        start: document.getElementById('screen-start'),
        game: document.getElementById('screen-game'),
        result: document.getElementById('screen-result'),
    };
    const card = document.getElementById('swipe-card');
    const cardImage = document.getElementById('card-image');
    const labelLike = document.getElementById('label-like');
    const labelSkip = document.getElementById('label-skip');
    const progressFill = document.getElementById('progress-fill');
    const currentNum = document.getElementById('current-num');
    const totalNum = document.getElementById('total-num');
    const likeCount = document.getElementById('like-count');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const likedGrid = document.getElementById('liked-grid');
    const resultStats = document.getElementById('result-stats');

    // ===== AUDIO (Web Audio API) =====
    let audioCtx = null;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playWhoosh() {
        try {
            const ctx = getAudioCtx();
            const dur = 0.25;
            const bufferSize = ctx.sampleRate * dur;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const t = i / bufferSize;
                data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.3;
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + dur);
            filter.Q.value = 1;
            source.connect(filter);
            filter.connect(ctx.destination);
            source.start();
        } catch (e) { /* silent fail */ }
    }

    function playSparkle() {
        try {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1200, t);
            osc1.frequency.exponentialRampToValueAtTime(2400, t + 0.15);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1600, t + 0.1);
            osc2.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            osc1.start(t);
            osc2.start(t + 0.08);
            osc1.stop(t + 0.3);
            osc2.stop(t + 0.35);
        } catch (e) { /* silent fail */ }
    }

    // ===== SCREEN MANAGEMENT =====
    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    // ===== IMAGE SHUFFLING =====
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function buildImageList() {
        const list = [];
        for (let i = 1; i <= TOTAL_IMAGES; i++) {
            list.push(`${IMAGE_PATH}${i}.png`);
        }
        return shuffleArray(list);
    }

    // ===== PRELOAD =====
    function preloadImages(list) {
        list.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }

    // ===== GAME INIT =====
    function initGame() {
        currentIndex = 0;
        likedImages = [];
        images = buildImageList();
        preloadImages(images);
        totalNum.textContent = TOTAL_IMAGES;
        likeCount.textContent = '0';
        updateProgress();
        loadCard();
        showScreen('game');
    }

    function updateProgress() {
        currentNum.textContent = currentIndex + 1;
        const pct = (currentIndex / TOTAL_IMAGES) * 100;
        progressFill.style.width = pct + '%';
    }

    function loadCard() {
        if (currentIndex >= TOTAL_IMAGES) {
            showResults();
            return;
        }
        cardImage.src = images[currentIndex];
        card.style.transform = '';
        card.style.opacity = '1';
        card.classList.remove('animate-out', 'tint-like', 'tint-skip');
        labelLike.style.opacity = '0';
        labelSkip.style.opacity = '0';
        isAnimating = false;
    }

    // ===== DRAG / SWIPE =====
    function getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function onDragStart(e) {
        if (isAnimating) return;
        e.preventDefault();
        isDragging = true;
        const pos = getEventPos(e);
        startX = pos.x;
        startY = pos.y;
        currentX = 0;
        card.classList.add('dragging');
    }

    function onDragMove(e) {
        if (!isDragging || isAnimating) return;
        e.preventDefault();
        const pos = getEventPos(e);
        currentX = pos.x - startX;
        const currentY = pos.y - startY;
        const rotation = currentX * 0.08;
        const clampedY = Math.min(currentY * 0.3, 30);

        card.style.transform = `translate(${currentX}px, ${clampedY}px) rotate(${rotation}deg)`;

        // Tint & labels
        const ratio = Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1);
        if (currentX > 20) {
            card.classList.add('tint-like');
            card.classList.remove('tint-skip');
            labelLike.style.opacity = ratio;
            labelSkip.style.opacity = '0';
        } else if (currentX < -20) {
            card.classList.add('tint-skip');
            card.classList.remove('tint-like');
            labelSkip.style.opacity = ratio;
            labelLike.style.opacity = '0';
        } else {
            card.classList.remove('tint-like', 'tint-skip');
            labelLike.style.opacity = '0';
            labelSkip.style.opacity = '0';
        }
    }

    function onDragEnd(e) {
        if (!isDragging || isAnimating) return;
        isDragging = false;
        card.classList.remove('dragging');

        if (Math.abs(currentX) >= SWIPE_THRESHOLD) {
            const direction = currentX > 0 ? 'right' : 'left';
            completeSwipe(direction);
        } else {
            // Snap back
            card.style.transition = 'transform 0.3s ease';
            card.style.transform = '';
            card.classList.remove('tint-like', 'tint-skip');
            labelLike.style.opacity = '0';
            labelSkip.style.opacity = '0';
            setTimeout(() => {
                card.style.transition = '';
            }, 300);
        }
    }

    function completeSwipe(direction) {
        isAnimating = true;
        const isLike = direction === 'right';

        playWhoosh();
        if (isLike) {
            playSparkle();
            likedImages.push(images[currentIndex]);
            likeCount.textContent = likedImages.length;
        }

        // Fly off
        const flyX = isLike ? FLY_DISTANCE : -FLY_DISTANCE;
        const flyRotation = isLike ? 30 : -30;

        card.classList.add('animate-out');
        card.style.transform = `translate(${flyX}px, -100px) rotate(${flyRotation}deg)`;
        card.style.opacity = '0';

        setTimeout(() => {
            currentIndex++;
            updateProgress();
            loadCard();
        }, 350);
    }

    // ===== RESULTS =====
    function showResults() {
        showScreen('result');
        likedGrid.innerHTML = '';

        const count = likedImages.length;

        if (count === 0) {
            resultTitle.innerHTML = '厳しすぎ！<br><span class="title-en">Too picky!</span>';
            resultMessage.textContent = '一つもLIKEしなかった…次はもっと寛容に！\nYou didn\'t like any! Try being more generous!';
            resultMessage.classList.add('empty');
        } else {
            resultTitle.innerHTML = `あなたの推しTOP${count}選<br><span class="title-en">Your Top ${count} Favorites</span>`;
            resultMessage.textContent = '';
            resultMessage.classList.remove('empty');

            likedImages.forEach((src, i) => {
                const img = document.createElement('img');
                img.src = src;
                img.alt = `Liked #${i + 1}`;
                img.style.animationDelay = `${i * 0.05}s`;
                likedGrid.appendChild(img);
            });
        }

        resultStats.textContent = `LIKED: ${count} / ${TOTAL_IMAGES} (${Math.round(count / TOTAL_IMAGES * 100)}%)`;
    }

    // ===== SHARE =====
    function shareOnX() {
        const count = likedImages.length;
        let text;
        if (count === 0) {
            text = '【筋肉フリック】全スキップ！厳しすぎ！💪👋 #MuscleLove #筋肉フリック';
        } else {
            text = `【筋肉フリック】推し筋肉TOP${count}選！💪 #MuscleLove #筋肉フリック`;
        }
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // ===== EVENT LISTENERS =====
    // Start
    document.getElementById('btn-start').addEventListener('click', () => {
        initGame();
    });

    // Retry
    document.getElementById('btn-retry').addEventListener('click', () => {
        initGame();
    });

    // Share
    document.getElementById('btn-share').addEventListener('click', shareOnX);

    // Mouse events
    card.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    // Touch events
    card.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);

    // Keyboard (arrow keys for accessibility)
    document.addEventListener('keydown', (e) => {
        if (screens.game.classList.contains('active') && !isAnimating) {
            if (e.key === 'ArrowRight') {
                currentX = SWIPE_THRESHOLD + 1;
                completeSwipe('right');
            } else if (e.key === 'ArrowLeft') {
                currentX = -(SWIPE_THRESHOLD + 1);
                completeSwipe('left');
            }
        }
    });
})();
