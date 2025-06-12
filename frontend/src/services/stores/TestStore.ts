import { makeAutoObservable } from 'mobx';
import { HighLoadTestStats } from '../../utils/test/high-load-test';

// Добавляем интерфейс для Regular Test статистики
export interface RegularTestStats {
    usersCreated: number;
    postsCreated: number;
    totalUsers: number;
    totalPosts: number;
    durationMs: number;
    withMedia: boolean;
    errors: number;
}

export default class TestStore {
    // Состояние выполнения теста
    isTestRunning = false;

    // Настройки теста
    usersCount = 5;
    postsPerUser = 20;
    generateWithMedia = true;
    isHighLoadMode = false;
    concurrentUsers = 10;

    // Результаты тестов
    highLoadStats: HighLoadTestStats | null = null;
    regularTestStats: RegularTestStats | null = null; // Добавляем статистику для Regular

    // Позиция панели
    panelPosition = { top: 100, left: 100 };
    isPanelVisible = false;

    constructor() {
        makeAutoObservable(this);
        this.loadFromStorage();
    }

    // Существующие методы...
    setTestRunning(running: boolean) {
        this.isTestRunning = running;
        this.saveToStorage();
    }

    setUsersCount(count: number) {
        this.usersCount = count;
        this.saveToStorage();
    }

    setPostsPerUser(count: number) {
        this.postsPerUser = count;
        this.saveToStorage();
    }

    setGenerateWithMedia(withMedia: boolean) {
        this.generateWithMedia = withMedia;
        this.saveToStorage();
    }

    setHighLoadMode(isHighLoad: boolean) {
        this.isHighLoadMode = isHighLoad;
        this.saveToStorage();
    }

    setConcurrentUsers(count: number) {
        this.concurrentUsers = count;
        this.saveToStorage();
    }
    clearQueue() {
        if (this.highLoadStats && this.highLoadStats.posts.queued > 0) {
            const queuedCount = this.highLoadStats.posts.queued;

            const updatedStats = {
                ...this.highLoadStats,
                posts: {
                    ...this.highLoadStats.posts,
                    created: this.highLoadStats.posts.created + queuedCount,
                    queued: 0,
                }
            };

            console.log(`[TestStore] 🔄 Moving ${queuedCount} queued posts to created`);
            this.setHighLoadStats(updatedStats);

            return queuedCount;
        }
        return 0;
    }
    setHighLoadStats(stats: HighLoadTestStats | null) {
        if (stats) {
            // Создаем глубокую копию для избежания мутаций
            const correctedStats: HighLoadTestStats = {
                ...stats,
                posts: {
                    ...stats.posts,
                    // Убеждаемся что все значения числовые
                    created: Number(stats.posts.created) || 0,
                    queued: Number(stats.posts.queued) || 0,
                    failed: Number(stats.posts.failed) || 0,
                    rateLimited: Number(stats.posts.rateLimited) || 0,
                    total: Number(stats.posts.total) || 0,
                },
                users: {
                    ...stats.users,
                    created: Number(stats.users.created) || 0,
                    failed: Number(stats.users.failed) || 0,
                    total: Number(stats.users.total) || 0,
                },
                durationMs: Number(stats.durationMs) || 0,
            };


            console.log(`[TestStore] Setting stats:`, correctedStats);
            this.highLoadStats = correctedStats;
        } else {
            this.highLoadStats = null;
        }

        this.saveToStorage();
    }

    // Новый метод для Regular Test статистики
    setRegularTestStats(stats: RegularTestStats | null) {
        this.regularTestStats = stats;
        this.saveToStorage();
    }

    setPanelPosition(position: { top: number; left: number }) {
        this.panelPosition = position;
        this.saveToStorage();
    }

    setPanelVisible(visible: boolean) {
        this.isPanelVisible = visible;
        this.saveToStorage();
    }

    // Сохранение в localStorage
    private saveToStorage() {
        try {
            const data = {
                isTestRunning: this.isTestRunning,
                usersCount: this.usersCount,
                postsPerUser: this.postsPerUser,
                generateWithMedia: this.generateWithMedia,
                isHighLoadMode: this.isHighLoadMode,
                concurrentUsers: this.concurrentUsers,
                highLoadStats: this.highLoadStats,
                regularTestStats: this.regularTestStats, // Добавляем в сохранение
                panelPosition: this.panelPosition,
                isPanelVisible: this.isPanelVisible,
            };
            localStorage.setItem('testPanelState', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save test panel state', e);
        }
    }

    // Загрузка из localStorage
    private loadFromStorage() {
        try {
            const saved = localStorage.getItem('testPanelState');
            if (saved) {
                const data = JSON.parse(saved);
                this.isTestRunning = data.isTestRunning || false;
                this.usersCount = data.usersCount || 5;
                this.postsPerUser = data.postsPerUser || 20;
                this.generateWithMedia = data.generateWithMedia !== undefined ? data.generateWithMedia : true;
                this.isHighLoadMode = data.isHighLoadMode || false;
                this.concurrentUsers = data.concurrentUsers || 10;
                this.highLoadStats = data.highLoadStats || null;
                this.regularTestStats = data.regularTestStats || null; // Загружаем Regular статистику
                this.panelPosition = data.panelPosition || { top: 100, left: 100 };
                this.isPanelVisible = data.isPanelVisible || false;
            }
        } catch (e) {
            console.error('Failed to load test panel state', e);
        }
    }

    // Очистка состояния теста
    resetTestState() {
        this.isTestRunning = false;
        this.highLoadStats = null;
        this.regularTestStats = null; // Очищаем и Regular статистику
        this.saveToStorage();
    }

    get totalMessages() {
        return this.usersCount * this.postsPerUser;
    }

    get maxUsers() {
        return this.isHighLoadMode ? 100000 : 100;
    }

    get isDataValid() {
        return (
            this.usersCount >= 1 &&
            this.usersCount <= this.maxUsers &&
            this.postsPerUser >= 1 &&
            this.postsPerUser <= 1000 &&
            (!this.isHighLoadMode || (this.concurrentUsers >= 1 && this.concurrentUsers <= 50))
        );
    }
}