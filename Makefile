PNPM ?= pnpm

.PHONY: install build watch test lint package pre-commit

install:
	$(PNPM) install

build:
	$(PNPM) compile

watch:
	$(PNPM) watch

test:
	$(PNPM) test

lint:
	$(PNPM) lint

optimize-icons:
	svgo --folder ./media/logo -o ./media/logo
	svgo --folder ./media/icon -o ./media/icon

# Build VS Code 拡張の .vsix パッケージ（必要時のみ）
package:
	rm -rf out/ *.vsix
	$(PNPM) exec vsce package --allow-star-activation

run-gha:
	act

# pre-commit フックと同等の実行（手動確認用）
pre-commit:
	$(PNPM) exec pre-commit run --all-files
	
clean:
	rm -rf out/ *.vsix node_modules
	
