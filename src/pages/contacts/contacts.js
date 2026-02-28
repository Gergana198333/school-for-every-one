export function init(root) {
  const form = root.querySelector('#contact-form');
  const message = root.querySelector('#form-message');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    message?.classList.remove('d-none');
    form.reset();
  });
}
