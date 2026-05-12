document.addEventListener('alpine:initialized', () => {
    const hooks = Alpine.store('hooks');
    const app = Alpine.store('app');
    const actions = Alpine.store('actions');

    let themeLtLock = false;
    let themeRtLock = false;
    let dpadLockX = false;
    let dpadLockY = false;
    app.customTileBgs = {};

    hooks.on('onViewChange', (data) => {
        const app = Alpine.store('app');
        if (app.showGameInfoOverlay) {
            app.showGameInfoOverlay = false;
        }
    });

hooks.on('onAppReady', async () => {
        let themeMods = await window.electronAPI.get('mods_' + app.currentTheme) || {};
        app.customTileBgs = themeMods.customTileBgs || {};
    });

    hooks.on('onAppReady', async (data) => {
    app.masterIndex = 0;        
    app.focusedList = 'detail'; 
    actions.updateDetailMenu(); 

        const originalMoveFocus = actions.moveFocus;
        actions.moveFocus = function(direction) {
            if (app.focusedCollection === 'displayItems') {
                let newIndex = app.focusedIndex + direction;
                if (newIndex < 0) newIndex = 0;
                if (newIndex > 3) newIndex = 3; 
                
                if (newIndex !== app.focusedIndex) {
                    app.focusedIndex = newIndex;
                    this.playSound('focus');
                    this.scrollToFocusedElement('display-item-' + newIndex);
                }
                return; 
            }
            originalMoveFocus.call(this, direction);
        };
        
        const originalSelectFocusedItemDisplay = actions.selectFocusedItem;
        actions.selectFocusedItem = function() {
            const app = Alpine.store('app');
            if (app.focusedCollection === 'displayItems') {
                this.playSound('select');
                const bgKeys = ['homeBg', 'gamesBg', 'settingsBg', 'aboutBg'];
                this.changeTabBg(bgKeys[app.focusedIndex]);
                return;
            }
            originalSelectFocusedItemDisplay.call(this);
        };

        
        actions.changeTabBg = async function(bgKey) {
            const app = Alpine.store('app');
            const filePath = await window.electronAPI.openImageFile();
            if (filePath) {
                await this._saveDisplaySetting('user' + bgKey, bgKey, filePath);
                app.displaySettings[bgKey] = filePath;
                this.playSound('channelUp');
            }
        };

        
        actions.resetDisplaySettings = async function() {
            const app = Alpine.store('app');
            const bgKeys = ['homeBg', 'gamesBg', 'settingsBg', 'aboutBg'];
            for (let key of bgKeys) {
                await this._saveDisplaySetting('user' + key, key, null);
                app.displaySettings[key] = null;
            }
            this.playSound('panelUnfold');
        };

        
        const bgKeys = ['homeBg', 'gamesBg', 'settingsBg', 'aboutBg'];
        const themeData = app.themesList.find(t => t.name === app.currentTheme);
        const isExternal = themeData && themeData.type === 'external';

        for (let key of bgKeys) {
            let savedBg = null;
            if (isExternal) {
                let themeMods = await window.electronAPI.get('mods_' + app.currentTheme) || {};
                if (themeMods.displaySettings) savedBg = themeMods.displaySettings[key];
            } else {
                savedBg = await window.electronAPI.get('user' + key);
            }
            
            if (savedBg && await window.electronAPI.checkPathExists(savedBg)) {
                app.displaySettings[key] = savedBg;
            } else {
                app.displaySettings[key] = null;
            }
        }

        actions.updateDetailMenu = function() {
            const app = Alpine.store('app');
            if (app.masterMenu.length === 0) return; 

            
            app.detailMenu = [...app.masterMenu[app.masterIndex].detailMenu];
            if (app.previousMasterIndex !== app.masterIndex) {
                app.detailIndex = 0;
                app.previousMasterIndex = app.masterIndex;
            }

            
            if (app.selectedGame && app.masterIndex === 0) { 
                
                let trayItem = app.detailMenu[0]; 
                if (trayItem) {
                    trayItem.name = app.selectedGame.name.replace(/\s*\(.*?\)\s*/g, '').trim();
                    trayItem.icon = app.selectedGame.coverUrl || app.selectedGame.iconUrl;
                    trayItem.logoUrl = ''; 
                    trayItem.heroUrl = app.selectedGame.heroUrl || 'none';
                    trayItem.isGameIcon = true; 
                    trayItem.id = 'game-loaded'; 
                }

                
                let exploreItem = app.detailMenu[1]; 
                if (exploreItem) {
                    let newHero = 'assets/images/items/logo_home.webp'; 
                    
                    if (app.selectedGame.heroUrl && app.selectedGame.heroUrl !== 'none' && app.selectedGame.heroUrl.trim() !== '') {
                        newHero = app.selectedGame.heroUrl;
                        if (newHero.includes(':\\') && !newHero.startsWith('file://')) {
                            newHero = 'file:///' + newHero;
                        }
                        newHero = newHero.replace(/\\/g, '/');
                    }
                    
                    exploreItem.heroUrl = newHero;
                    
                    app.detailMenu[1] = { ...exploreItem }; 
                }
            }
            
            if (app.masterIndex === 1) { 
                
                
                
                const games = app.filteredLibraryGames || app.gamesList || [];
                const validGames = games.filter(g => g.heroUrl && g.heroUrl !== 'none');
                
                const fixPath = (path) => {
                    if (!path || path === 'none') return '';
                    let cleanPath = path;
                    if (cleanPath.includes(':\\') && !cleanPath.startsWith('file://')) {
                        cleanPath = 'file:///' + cleanPath;
                    }
                    return cleanPath.replace(/\\/g, '/');
                };

                if (validGames.length > 0) {
                    const randomIndex = Math.floor(Math.random() * validGames.length);
                    const updateImages = (gameIndex) => {
                        const game = validGames[gameIndex];
                        const hero = fixPath(game.heroUrl);
                        const logo = fixPath(game.logoUrl);
                        
                        app.isHeroFading = true;
                        
                        setTimeout(() => {
                            const detailTile = app.detailMenu.find(d => d.id === 'gamelibrary');
                            if (detailTile) {
                                detailTile.heroUrl = hero;
                                detailTile.logoUrl = logo;
                            }
                            
                            const masterTile = app.masterMenu[1].detailMenu.find(d => d.id === 'gamelibrary');
                            if (masterTile) {
                                masterTile.heroUrl = hero;
                                masterTile.logoUrl = logo;
                            }
                            
                            setTimeout(() => {
                                app.isHeroFading = false;
                            }, 50); 
                        }, 400); 
                    };

                    updateImages(randomIndex);

                    if (window.heroInterval) clearInterval(window.heroInterval);
                    
                    let currentIdx = randomIndex;
                    window.heroInterval = setInterval(() => {
                        
                        if (app.detailIndex !== 0) return;
                        
                        currentIdx = (currentIdx + 1) % validGames.length;
                        updateImages(currentIdx); 
                    }, 5000); 
                }

                
                
                
                const allAchievements = [];
                
                if (app.achievementsGamesList && app.achievementsGamesList.length > 0) {
                    app.achievementsGamesList.forEach(game => {
                        if (game.realAchievements) {
                            game.realAchievements.forEach(ach => {
                                
                                if (ach.unlocked) {
                                    allAchievements.push({
                                        ...ach,
                                        gameName: game.name,
                                        gameIcon: game.coverUrl || game.iconUrl
                                    });
                                }
                            });
                        }
                    });
                }

                if (allAchievements.length > 0) {
                    const updateRandomAchievement = () => {
                        
                        if (app.detailIndex !== 1) return;

                        const randomIdx = Math.floor(Math.random() * allAchievements.length);
                        app.isAchievementFading = true;
                        
                        setTimeout(() => {
                            app.currentRandomAchievement = allAchievements[randomIdx];
                            
                            setTimeout(() => {
                                app.isAchievementFading = false;
                            }, 50);
                        }, 400);
                    };

                    if (!app.currentRandomAchievement) {
                        app.currentRandomAchievement = allAchievements[Math.floor(Math.random() * allAchievements.length)];
                    }

                    if (window.achInterval) clearInterval(window.achInterval);
                    window.achInterval = setInterval(updateRandomAchievement, 6000); 
                }

            } else {
                
                
                
                if (window.heroInterval) {
                    clearInterval(window.heroInterval);
                    window.heroInterval = null;
                }
                if (window.achInterval) {
                    clearInterval(window.achInterval);
                    window.achInterval = null;
                }
            }
        };

        
        actions.moveAchievementGridFocus = function(rowDir, colDir) {
            const app = Alpine.store('app');
            if (!app.selectedAchievementGame || app.ach_lock) return;

            const achievements = app.selectedAchievementGame.realAchievements;
            
            
            let cols = 8; 
            const gridContainer = document.querySelector('.ach-right-grid');
            if (gridContainer) {
                const computedStyle = window.getComputedStyle(gridContainer);
                const gridColumns = computedStyle.gridTemplateColumns.split(' ');
                cols = gridColumns.length; 
            }

            let newIndex = app.focusedAchievementIndex;

            if (colDir !== 0) newIndex += colDir;
            if (rowDir !== 0) newIndex += (rowDir * cols);

            
            if (newIndex >= 0 && newIndex < achievements.length) {
                app.focusedAchievementIndex = newIndex;
                this.playSound('focus');
                app.ach_lock = true;
                setTimeout(() => { app.ach_lock = false; }, 150);

                
                const el = document.getElementById('ach-slot-' + newIndex);
                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        };
        

        const originalSelectFocusedItem = actions.selectFocusedItem;
        actions.selectFocusedItem = function() {
            const app = Alpine.store('app');
            if (app.focusedCollection === 'filteredLibraryGames' || app.focusedCollection === 'gamesList') {
                const item = app[app.focusedCollection][app.focusedIndex];
                if (item && item.path && !app.gameSelectionAnimating) {
                    app.gameSelectionAnimating = true;
                    app.selectedGame = item;
                    this.playSound('select');
                    
                    setTimeout(() => {
                        this.goBack(); 
                        setTimeout(() => {
                            
                            app.masterIndex = 0; 
                            actions.updateDetailMenu(); 
                            app.detailIndex = 0; 
                            app.focusedList = 'detail';
                            app.gameSelectionAnimating = false;
                        }, 800);
                    }, 500);
                }
                return; 
            }
            originalSelectFocusedItem.call(this);
        };
        const originalSelectDetailItem = actions.selectDetailItem;
        actions.selectDetailItem = function() {
            const app = Alpine.store('app');
            
            if (app.focusedList === 'detail') {
                const focusedItem = app.detailMenu[app.detailIndex];
                
                if (focusedItem && focusedItem.view === 'none') {
                    this.changeCustomTileBg(focusedItem);
                    return;
                }
            }
            
            if (originalSelectDetailItem) {
                originalSelectDetailItem.call(this);
            }
        };
});

    hooks.on('onGamepadInput', (input) => {
        if (input.event === 'button_x' && input.value > 0.5) {
            if (app.focusedList === 'detail') {
                const focusedItem = app.detailMenu[app.detailIndex];
                if (focusedItem && focusedItem.view === 'none' && app.customTileBgs[focusedItem.id]) {
                    actions.resetCustomTileBg(focusedItem);
                }
            }
        }
        if (input.event === 'button_a' && input.value > 0.5) {
            if (app.currentView === 'dashboard' && !app.isKeyboardOpen && !app.isProfileSelectorOpen && !app.isGuideOpen) {
                if (app.focusedList === 'detail') {
                    const focusedItem = app.detailMenu[app.detailIndex];
                    if (focusedItem && focusedItem.view === 'none') {
                        actions.changeCustomTileBg(focusedItem);
                        return; 
                    }
                }
            }
        }
    if (app.currentView === 'dashboard') {
        
        
        if (app.isKeyboardOpen || app.isProfileSelectorOpen || app.isGuideOpen || app.showGameInfoOverlay || app.isFriendsOverlayOpen) {
            return;
        }

        if (app.focusedList !== 'detail') {
            app.focusedList = 'detail';
        }

        if (input.event === 'left_trigger') {
            if (input.value > 0.8 && !themeLtLock) {
                themeLtLock = true;
                let newIndex = app.masterIndex - 1;
                if (newIndex >= 0) {
                    app.masterIndex = newIndex;
                    app.detailIndex = 0; 
                    actions.playSound('channelUp');
                    actions.updateDetailMenu();
                }
            } else if (input.value < 0.1) { themeLtLock = false; }
        }
        
        if (input.event === 'right_trigger') {
            if (input.value > 0.8 && !themeRtLock) {
                themeRtLock = true;
                let newIndex = app.masterIndex + 1;
                if (newIndex < app.masterMenu.length) {
                    app.masterIndex = newIndex;
                    app.detailIndex = 0; 
                    actions.playSound('channelDown');
                    actions.updateDetailMenu();
                }
            } else if (input.value < 0.1) { themeRtLock = false; }
        }

        
        const isNavEvent = ['dpad_x', 'dpad_y', 'left_stick_x', 'left_stick_y'].includes(input.event);
        if (isNavEvent) {
            app.inputLocked = true; 
            setTimeout(() => app.inputLocked = false, 20);

            if (input.event === 'dpad_x' || input.event === 'left_stick_x') {
                if (Math.abs(input.value) > 0.5 && !dpadLockX) {
                    dpadLockX = true;
                    setTimeout(() => dpadLockX = false, 150);
                    handleStrictGrid(input.value > 0 ? 'right' : 'left');
                } else if (input.value === 0) { dpadLockX = false; }
            }

            if (input.event === 'dpad_y' || input.event === 'left_stick_y') {
                if (Math.abs(input.value) > 0.5 && !dpadLockY) {
                    dpadLockY = true;
                    setTimeout(() => dpadLockY = false, 150);
                    
                    let yValue = input.value;
                    if (input.event === 'left_stick_y' && window.navigator.platform.toLowerCase().includes('win')) {
                        yValue = -yValue; 
                    }
                    
                    handleStrictGrid(yValue > 0 ? 'down' : 'up');
                    
                } else if (input.value === 0) { dpadLockY = false; }
            }
        }
    }
});




document.addEventListener('keydown', (e) => {
    if (app.currentView !== 'dashboard') return;
    
    if (app.isKeyboardOpen || app.isProfileSelectorOpen || app.isGuideOpen || app.showGameInfoOverlay) return;

    const key = e.key;

    if (key === 'q' || key === 'Q' || key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        let newIndex = app.masterIndex - 1;
        if (newIndex >= 0) {
            app.masterIndex = newIndex;
            app.detailIndex = 0; 
            actions.playSound('channelUp');
            actions.updateDetailMenu();
        }
        return;
    }
    
    if (key === 'e' || key === 'E' || key === 'PageDown') {
        e.preventDefault();
        e.stopPropagation();
        let newIndex = app.masterIndex + 1;
        if (newIndex < app.masterMenu.length) {
            app.masterIndex = newIndex;
            app.detailIndex = 0; 
            actions.playSound('channelDown');
            actions.updateDetailMenu();
        }
        return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        const direction = key.replace('Arrow', '').toLowerCase();
        handleStrictGrid(direction);
    }
}, true);


    
    
    function handleStrictGrid(direction) {
        const currentTab = app.masterMenu[app.masterIndex].id;
        let navMap = {};

        if (currentTab === 'home') {
            
            navMap = {
                0: { up: 0, down: 0}
            };
        } else if (currentTab === 'games') {
            
            navMap = {
                0: { up: 1, down: 1, left: 0, right: 0 },  
                1: { up: 0, down: 0, left: 1, right: 1 }   
            };
        } else if (currentTab === 'settings') {
            navMap = {
                0: { up: 4, down: 1 },  
                1: { up: 0, down: 2 },  
                2: { up: 1, down: 3 },  
                3: { up: 2, down: 4 },  
                4: { up: 3, down: 0 }   
            };
        }

        const currentIndex = app.detailIndex;
        const nextIndex = navMap[currentIndex]?.[direction];

        if (nextIndex !== undefined && nextIndex !== currentIndex && nextIndex < app.detailMenu.length) {
            app.detailIndex = nextIndex;
            actions.playSound('focus');
        }
    }

    
    
    
    Alpine.store('actions').loadDashboardData = async function() {
        const app = Alpine.store('app');

        app.settingsMenu = app.settingsMenu.filter(item => item.id !== 'colors');
        const metroMenuData = [
            {
            "id": "home",
            "name": "HOME",
            "detailMenu": [
                { "id": "opentray", "name": "Open Tray", "view": "opentray", "icon": ""},
                { "id": "explore", "name": "", "view": "none", "icon": "", "heroUrl": "assets/images/items/logo_home.webp"  }
            ] 
            },
            {
            "id": "games",
            "name": "GAMES",
            "detailMenu": [
                { "id": "gamelibrary", "name": "Games Library", "view": "game-library", "icon": "/assets/icons/games.png" },
                { "id": "achievements", "name": "Achievement", "view": "achievements", "icon": "/assets/icons/achievements.png" }
            ] 
            },
            {
            "id": "settings",
            "name": "SETTINGS",
            "detailMenu": [
                { "id": "Settings-Core", "name": "Settings Core", "view": "settings-core", "icon": "/assets/icons/Console-Xbox.png" },
                { "id": "Settings-Theme", "name": "Themes Settings", "view": "settings-system", "icon": "/assets/icons/System Settings.png" },
                { "id": "Settings-Wellpaper", "name": "Wellpaper Settings", "view": "settings-display", "icon": "/assets/icons/wallpaper_settings.png" },
                { "id": "Settings-Sound", "name": "Sound Settings", "view": "settings-audio", "icon": "/assets/icons/Sound.png" },
                { "id": "Settings-Language", "name": "Language", "view": "language-select", "icon": "/assets/icons/earth.png" }
            ] 
            },
            {
            "id": "about",
            "name": "ABOUT",
            "detailMenu": [
                { "id": "about", "name": "About Project", "view": "about-hub", "icon": "/assets/icons/About.webp", "heroUrl": "assets/images/items/About-center.gif" },
            ] 
            }
        ];

        app.masterMenu = metroMenuData;
        app.focusedList = 'detail'; 
        Alpine.store('actions').applyThemeIconsToMenus();
        Alpine.store('actions').updateDetailMenu();

    };
    
    hooks.on('onAppReady', async () => {
        const app = Alpine.store('app');
        try {
            
            const response = await fetch('theme-locales.json');
            const themeTranslations = await response.json();

            
            for (const lang in themeTranslations) {
                if (!app.translations[lang]) {
                    app.translations[lang] = {};
                }

                for (const category in themeTranslations[lang]) {
                    if (!app.translations[lang][category]) {
                        app.translations[lang][category] = {};
                    }

                    Object.assign(
                        app.translations[lang][category], 
                        themeTranslations[lang][category]
                    );
                }
            }
            console.log("[Theme] External JSON translations loaded and merged!");
        } catch (error) {
            console.error("[Theme] Failed to load external translations:", error);
        }
    });

});