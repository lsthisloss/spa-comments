export function getAvatarColor(letter: string): string {
    const palette = [
      '#3b3b98', '#182C61', '#006266', '#5758BB', '#303952', '#218c5a', '#b33939',
      '#222f3e', '#1e3799', '#6D214F', '#2C3A47', '#4a69bd', '#2d3436', '#4834d4',
      '#009432', '#cd6133',
    ];
    const code = letter.toUpperCase().charCodeAt(0);
    return palette[code % palette.length];
  }