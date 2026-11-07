/** Compact rounded horizontal runs; the three finder eyes are drawn separately. */
export function qrModulePath(matrix: readonly (readonly number[])[]): string {
  const size = matrix.length;
  const eye = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const paths: string[] = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!matrix[y]?.[x] || eye(x, y)) { x++; continue; }
      const start = x;
      while (x < size && matrix[y]?.[x] && !eye(x, y)) x++;
      const length = x - start;
      paths.push(`M${start + 0.15} ${y}h${length - 0.3}q.15 0 .15 .15v.7q0 .15 -.15 .15h-${length - 0.3}q-.15 0 -.15 -.15v-.7q0 -.15 .15 -.15z`);
    }
  }
  return paths.join("");
}
