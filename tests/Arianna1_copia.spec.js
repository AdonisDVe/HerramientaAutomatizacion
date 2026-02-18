import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://sirio-dev-frontend-alb-894180136.us-east-1.elb.amazonaws.com/user/login');
  await page.locator('div').filter({ hasText: /^Usuario \*$/ }).nth(2).click();
  await page.getByRole('textbox', { name: 'Usuario' }).fill('gabriel.silva');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('0987654321');
  await page.getByRole('button', { name: 'INGRESAR' }).click();
  await page.getByText('Personas expand_more').click();
  await page.getByRole('link', { name: 'Naturales', exact: true }).click();
  await page.getByRole('textbox', { name: 'Número de documento' }).click();
  await page.getByRole('textbox', { name: 'Número de documento' }).fill('18124126');
  await page.getByRole('textbox', { name: 'Número de documento' }).press('Tab');
  await page.getByRole('button', { name: ' Actualizar' }).click();
  await page.getByRole('spinbutton', { name: 'Carga familiar' }).click();
  await page.getByRole('spinbutton', { name: 'Carga familiar' }).fill('3');
  await page.getByRole('button', { name: '   Guardar' }).click();
  await page.getByRole('button', { name: 'GABRIEL.SILVA' }).click();
  await page.getByText('Salir').click();
});