export function getLikedPosts(): string[] {
    return JSON.parse(localStorage.getItem('likedPosts') || '[]');
  }
  
  export function setLikedPost(postId: string) {
    const liked = getLikedPosts();
    if (!liked.includes(postId)) {
      liked.push(postId);
      localStorage.setItem('likedPosts', JSON.stringify(liked));
    }
  }
  
  export function isPostLiked(postId: string): boolean {
    return getLikedPosts().includes(postId);
  }

  export function removeLikedPost(postId: string) {
    const liked = getLikedPosts().filter(id => id !== postId);
    localStorage.setItem('likedPosts', JSON.stringify(liked));
  }