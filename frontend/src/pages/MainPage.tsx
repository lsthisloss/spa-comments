import { observer } from 'mobx-react-lite';
import useNavigation from '../hooks/useNavigation';
import PostForm from '../components/posts/PostForm';
import PostsThread from '../components/posts/PostsThread';
import { useEffect } from 'react';
import { logger } from '../utils/Logger';

/*
  MainPage — компонент для отображения основной страницы приложения
  - Содержит форму для создания постов и список постов
  - Использует MobX для управления состоянием постов
  - Принимает активный таб (all или my) для определения, какие посты загружать
  - Отображает форму и список постов в секции main-page-section
*/

const MainPage = observer(({ activeTab }: { activeTab: 'all' | 'my' }) => {
  const { getState } = useNavigation();
  
  useEffect(() => {
    const initialState = getState();
    
    if (initialState?.forceRefresh) {
      logger.log('[MainPage] Force refresh detected in navigation state');
    }
  }, [getState]);

  return (
    <section className="main-page-section">
      <PostForm />
      <PostsThread activeTab={activeTab} />
    </section>
  );
});
export default MainPage;