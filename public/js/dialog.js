export const showDialog = (elem) => {
    const dialog = document.querySelector('dialog');
    if (!dialog) return Promise.resolve(null);
    while (dialog.firstChild) dialog.removeChild(dialog.firstChild);
    dialog.appendChild(elem);
    dialog.showModal();
    const p = Promise.withResolvers();

    dialog.addEventListener('close', () => {
        p.resolve(dialog.returnValue === 'default' ? null : dialog.returnValue);
    })

    return p.promise;
}