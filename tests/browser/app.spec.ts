import { test, expect } from "@playwright/test";
test("default speech order, field reinsertion and reset", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const order = page
    .locator(".field")
    .filter({ has: page.getByRole("button", { name: /^上移/ }) })
    .locator("span");
  const expected = [
    "1. 英语单词",
    "2. 中文释义",
    "3. 英语搭配",
    "4. 搭配中文",
    "5. 英语例句",
    "6. 中文例句",
  ];
  await expect(order).toHaveText(expected);
  const meaning = page.getByRole("checkbox", { name: "中文释义", exact: true });
  await meaning.uncheck();
  await meaning.check();
  await expect(order).toHaveText(expected);
  await page.getByRole("button", { name: "下移英语单词", exact: true }).click();
  await expect(order.first()).toHaveText("1. 中文释义");
  await page.getByRole("button", { name: "恢复默认顺序", exact: true }).click();
  await expect(order).toHaveText(expected);
});
test("multi-List loop selection persists and loop modes are exclusive", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("多个 List 循环", { exact: true }).check();
  await expect(page.getByRole("alert")).toContainText("至少选择一个 List");
  await page.getByLabel("List 03（50 词）", { exact: true }).check();
  await page.getByLabel("List 01（50 词）", { exact: true }).check();
  await expect(page.locator(".playlist-settings")).toContainText(
    "已选 2 个 List",
  );
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(
    page.getByLabel("多个 List 循环", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("List 01（50 词）", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("List 03（50 词）", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("当前单词循环", { exact: true }).check();
  await expect(
    page.getByLabel("多个 List 循环", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("当前 List 循环", { exact: true }).check();
  await expect(
    page.getByLabel("当前单词循环", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("多个 List 循环", { exact: true }).check();
  await expect(
    page.getByLabel("当前 List 循环", { exact: true }),
  ).not.toBeChecked();
});
test("fullscreen controls can hide and return without a zoom control", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "词汇图片" }).click();
  await expect(page.getByLabel("图片缩放")).toHaveCount(0);
  await page.getByRole("button", { name: "全屏", exact: true }).click();
  await page.getByRole("button", { name: "隐藏按钮" }).click();
  await expect(page.getByRole("button", { name: "退出全屏" })).toHaveCount(0);
  const area = page.locator(".fullscreen .image-scroll");
  const size = await area.boundingBox();
  expect(size!.height).toBe(page.viewportSize()!.height);
  await area.click();
  await page.getByRole("button", { name: "退出全屏" }).click();
  await expect(page.locator(".fullscreen")).toHaveCount(0);
});
test("read-only modes, tab position, numeric editing, persistence and layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("abstain");
  await page.getByRole("tab", { name: "词汇图片" }).click();
  await expect(page.locator("main img").first()).toBeVisible();
  await page.getByRole("button", { name: "下一词", exact: true }).click();
  await page.getByRole("tab", { name: "单词内容" }).click();
  await expect(page.locator(".word")).toContainText("弃权");
  await page.getByRole("button", { name: "仅文字", exact: true }).click();
  await expect(page.locator("main img")).toHaveCount(0);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const rate = page.getByLabel("英语语速", { exact: true });
  await rate.fill("");
  await expect(rate).toHaveValue("");
  await rate.fill("0.9");
  await rate.blur();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.reload();
  await expect(page.locator(".word")).toContainText("弃权");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("英语语速", { exact: true })).toHaveValue("0.9");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const main = await page.locator("main").boundingBox(),
    footer = await page.locator("footer").boundingBox();
  expect(main!.y + main!.height).toBeLessThanOrEqual(footer!.y);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "回到首词", exact: true }).click();
  await expect(page.locator('.word-strip [aria-current="true"]')).toHaveText(
    "1. abstain",
  );
  await expect(page.locator(".word")).toContainText("戒除");
});
test("missing pictures are readable and loaded content remains visible offline", async ({
  page,
  context,
}) => {
  await page.route("**/data/list01.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.items[0].images = [];
    await route.fulfill({ json: data });
  });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.getByRole("button", { name: "仅图片", exact: true }).click();
  await expect(page.getByText("此词暂无图片")).toBeVisible();
  // Browsers use a server here; APK asset requests do not need a network. Do not claim browser offline == APK offline.
  await context.setOffline(true);
  await expect(page.getByText("此词暂无图片")).toBeVisible();
});
