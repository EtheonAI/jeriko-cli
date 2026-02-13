() => {
  const body = document.body;
  const html = document.documentElement;

  const width = Math.max(
    body.scrollWidth,
    body.offsetWidth,
    body.clientWidth,
    html.scrollWidth,
  );
  const height = Math.max(
    body.scrollHeight,
    body.offsetHeight,
    body.clientHeight,
    html.scrollHeight,
  );
  
  return { width, height };
}

