import { observer } from 'mobx-react-lite';


import PostForm from '../components/posts/PostForm';
import PostsThread from '../components/posts/PostsThread';

/*
  MainPage — компонент для отображения основной страницы приложения
  - Содержит форму для создания постов и список постов
  - Использует MobX для управления состоянием постов
  - Принимает активный таб (all или my) для определения, какие посты загружать
  - Отображает форму и список постов в секции main-page-section
*/

const MainPage = observer(({ activeTab }: { activeTab: 'all' | 'my' }) => {
  return (
    <section className="main-page-section">
      <PostForm />
      
      <PostsThread activeTab={activeTab} />
    </section>
  );
});

export default MainPage;