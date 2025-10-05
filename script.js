document.addEventListener('DOMContentLoaded', () => {
    // --- 定数とグローバル変数 ---
    const LOCAL_STORAGE_KEY = 'youtubeVideos';
    const ITEMS_PER_PAGE = 10;
    const THUMBNAIL_QUALITIES = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];

    let currentPage = 1;

    // --- DOM要素 ---
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');
    const viewModeButton = document.getElementById('viewModeButton');
    const editModeButton = document.getElementById('editModeButton');
    const videoGrid = document.getElementById('videoGrid');
    const videoList = document.getElementById('videoList');
    const addVideoButton = document.getElementById('addVideoButton');
    const newVideoTitle = document.getElementById('newVideoTitle');
    const newVideoUrl = document.getElementById('newVideoUrl');
    const addError = document.getElementById('addError');

    const videoModal = document.getElementById('videoModal');
    const youtubePlayer = document.getElementById('youtubePlayer');
    const modalVideoTitle = document.getElementById('modalVideoTitle');
    const closeButton = document.querySelector('.close-button');

    const viewPrevButton = document.getElementById('viewPrevButton');
    const viewNextButton = document.getElementById('viewNextButton');
    const viewPageInfo = document.getElementById('viewPageInfo');
    const editPrevButton = document.getElementById('editPrevButton');
    const editNextButton = document.getElementById('editNextButton');
    const editPageInfo = document.getElementById('editPageInfo');

    // --- データ操作 (ローカルストレージ) ---

    /**
     * ローカルストレージから動画リストを読み込む
     * @returns {Array} 動画オブジェクトの配列
     */
    function loadVideos() {
        try {
            const data = localStorage.getItem(LOCAL_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("ローカルストレージからの読み込みエラー:", e);
            return [];
        }
    }

    /**
     * 動画リストをローカルストレージに保存する
     * @param {Array} videos - 保存する動画オブジェクトの配列
     */
    function saveVideos(videos) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(videos));
        } catch (e) {
            console.error("ローカルストレージへの保存エラー:", e);
        }
    }

    // --- ユーティリティ関数 ---

    /**
     * YouTube URLからVideo IDを抽出する
     * @param {string} url - YouTube動画のURL
     * @returns {string | null} Video ID または null
     */
    function getVideoId(url) {
        // watch?v=, embed/, youtu.be/ のいずれかに対応する正規表現
        const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?]*)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    /**
     * サムネイルのURLを生成する（品質指定）
     * @param {string} videoId - 動画のID
     * @param {number} qualityIndex - THUMBNAIL_QUALITIESのインデックス
     * @returns {string} サムネイルURL
     */
    function getThumbnailUrl(videoId, qualityIndex) {
        const quality = THUMBNAIL_QUALITIES[qualityIndex];
        return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
    }

    /**
     * サムネイルのフォールバック処理を試みる
     * 高画質から順に画像をロードし、失敗した場合は次の画質を試す
     * @param {HTMLElement} imgElement - 画像要素
     * @param {string} videoId - 動画ID
     * @param {number} qualityIndex - 現在試行中の品質インデックス
     */
    function tryLoadThumbnail(imgElement, videoId, qualityIndex = 0) {
        if (qualityIndex >= THUMBNAIL_QUALITIES.length) {
            // 全ての品質を試して失敗した場合
            imgElement.src = ''; 
            imgElement.alt = 'サムネイル画像が見つかりません';
            return;
        }

        const url = getThumbnailUrl(videoId, qualityIndex);
        imgElement.onload = null; // 成功時の処理は不要
        imgElement.onerror = () => {
            // ロード失敗: 次の品質を試す
            tryLoadThumbnail(imgElement, videoId, qualityIndex + 1);
        };
        imgElement.src = url;
    }


    // --- レンダリング (表示) ---

    /**
     * 見るモードの動画グリッドをレンダリングする
     */
    function renderViewMode() {
        const videos = loadVideos();
        videoGrid.innerHTML = '';

        const totalPages = Math.ceil(videos.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const currentVideos = videos.slice(startIndex, endIndex);

        currentVideos.forEach(video => {
            const videoId = getVideoId(video.url);
            if (!videoId) return;

            const card = document.createElement('div');
            card.className = 'video-card';
            card.setAttribute('data-video-id', videoId);
            card.setAttribute('data-title', video.title);

            // サムネイルコンテナ (16:9比率維持)
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnail-container';

            const img = document.createElement('img');
            img.alt = video.title;
            // サムネイルのロードとフォールバック処理を開始
            tryLoadThumbnail(img, videoId, 0); 
            
            thumbnailContainer.appendChild(img);
            card.appendChild(thumbnailContainer);

            // タイトルコンテナ
            const info = document.createElement('div');
            info.className = 'video-info';
            const title = document.createElement('p');
            title.className = 'video-title';
            title.textContent = video.title;
            info.appendChild(title);
            card.appendChild(info);

            // クリックイベントでモーダルを開く
            card.addEventListener('click', openModal);

            videoGrid.appendChild(card);
        });

        updatePaginationControls(videos.length, 'view');
    }

    /**
     * 編集モードの動画リストをレンダリングする
     */
    function renderEditMode() {
        const videos = loadVideos();
        videoList.innerHTML = '';

        const totalPages = Math.ceil(videos.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const currentVideos = videos.slice(startIndex, endIndex);

        currentVideos.forEach((video, index) => {
            // 表示されているインデックスを計算 (ページネーション対応)
            const actualIndex = startIndex + index; 

            const listItem = document.createElement('li');
            listItem.className = 'video-list-item';

            const details = document.createElement('div');
            details.className = 'item-details';
            details.innerHTML = `
                <p><strong>タイトル:</strong> ${video.title}</p>
                <p><strong>URL:</strong> ${video.url}</p>
            `;
            listItem.appendChild(details);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '×'; // ばつボタン
            deleteButton.title = '削除';
            // 削除ボタンのイベント。indexではなく、リスト内の**実際の**インデックスを渡す
            deleteButton.addEventListener('click', () => deleteVideo(actualIndex));

            listItem.appendChild(deleteButton);
            videoList.appendChild(listItem);
        });

        updatePaginationControls(videos.length, 'edit');
    }

    // --- ページネーション ---

    /**
     * ページネーションのコントロールと情報を更新する
     * @param {number} totalItems - 全アイテム数
     * @param {string} mode - 'view' または 'edit'
     */
    function updatePaginationControls(totalItems, mode) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        
        // モードごとにDOM要素を選択
        const prevButton = mode === 'view' ? viewPrevButton : editPrevButton;
        const nextButton = mode === 'view' ? viewNextButton : editNextButton;
        const pageInfo = mode === 'view' ? viewPageInfo : editPageInfo;

        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage >= totalPages;

        if (totalItems === 0) {
            pageInfo.textContent = '0件';
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        } else {
            pageInfo.textContent = `${currentPage}/${totalPages} ページ`;
            prevButton.style.display = 'inline-block';
            nextButton.style.display = 'inline-block';
        }
    }

    /**
     * 次のページへ移動し、レンダリングを更新する
     */
    function nextPage() {
        const videos = loadVideos();
        const totalPages = Math.ceil(videos.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            // スクロールリセット
            window.scrollTo(0, 0); 
            refreshModeView();
        }
    }

    /**
     * 前のページへ移動し、レンダリングを更新する
     */
    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            // スクロールリセット
            window.scrollTo(0, 0);
            refreshModeView();
        }
    }
    
    // --- イベントハンドラ ---

    /**
     * モード切り替え
     * @param {string} mode - 'view' or 'edit'
     */
    function switchMode(mode) {
        currentPage = 1; // モード切り替え時にページをリセット
        if (mode === 'view') {
            viewMode.classList.remove('hidden');
            editMode.classList.add('hidden');
            viewModeButton.classList.add('active');
            editModeButton.classList.remove('active');
            renderViewMode();
        } else {
            viewMode.classList.add('hidden');
            editMode.classList.remove('hidden');
            editModeButton.classList.add('active');
            viewModeButton.classList.remove('active');
            renderEditMode();
        }
    }

    /**
     * モーダルを開き、動画を再生する
     */
    function openModal() {
        const videoId = this.getAttribute('data-video-id');
        const title = this.getAttribute('data-title');
        
        youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        modalVideoTitle.textContent = title;
        videoModal.style.display = 'block';
    }

    /**
     * モーダルを閉じ、動画再生を停止する
     */
    function closeModal() {
        videoModal.style.display = 'none';
        // iframeのsrcをクリアして動画再生を停止する
        youtubePlayer.src = ''; 
    }
    
    /**
     * 新しい動画を追加する
     */
    function addVideo() {
        addError.textContent = '';
        const title = newVideoTitle.value.trim();
        const url = newVideoUrl.value.trim();

        if (!title || !url) {
            addError.textContent = 'タイトルとURLの両方を入力してください。';
            return;
        }

        if (!getVideoId(url)) {
            addError.textContent = '有効なYouTube URLを入力してください。';
            return;
        }

        const videos = loadVideos();
        const newVideo = { title, url, addedAt: new Date().toISOString() };
        
        // 最新のものを最初に表示 (リストの先頭に追加)
        videos.unshift(newVideo); 

        saveVideos(videos);
        
        // 入力欄をクリア
        newVideoTitle.value = '';
        newVideoUrl.value = '';
        
        // 追加されたので、編集モードのリストを再レンダリング
        currentPage = 1; // 追加後は1ページ目に戻す
        renderEditMode(); 
    }

    /**
     * 指定したインデックスの動画を削除する
     * @param {number} index - 削除する動画の配列インデックス
     */
    function deleteVideo(index) {
        if (!confirm('この動画をリストから削除してもよろしいですか？')) return;

        const videos = loadVideos();
        videos.splice(index, 1); // 該当インデックスのアイテムを削除
        saveVideos(videos);
        
        // ページネーションの調整 (最後のページで全て削除された場合など)
        const totalPages = Math.ceil(videos.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        } else if (videos.length === 0) {
            currentPage = 1;
        }

        renderEditMode(); // リストを再レンダリング
    }
    
    /**
     * 現在のモードの表示を更新する
     */
    function refreshModeView() {
        if (viewMode.classList.contains('active')) {
            renderViewMode();
        } else {
            renderEditMode();
        }
    }


    // --- 初期化とイベントリスナー設定 ---

    // モード切り替えボタン
    viewModeButton.addEventListener('click', () => switchMode('view'));
    editModeButton.addEventListener('click', () => switchMode('edit'));

    // 動画追加ボタン
    addVideoButton.addEventListener('click', addVideo);

    // モーダル操作
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === videoModal) {
            closeModal();
        }
    });

    // ページネーションボタン
    viewNextButton.addEventListener('click', nextPage);
    viewPrevButton.addEventListener('click', prevPage);
    editNextButton.addEventListener('click', nextPage);
    editPrevButton.addEventListener('click', prevPage);

    // 初期表示は「見るモード」
    switchMode('view'); 
});