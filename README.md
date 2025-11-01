# photo-editor-ai

Modern fotoğraf genişletme aracı. Kullanıcılar fotoğraf yükleyip standart oranları seçer, uygulama görseli yeni boyutuna göre tamamlar. Arka plan bulanıklaştırılarak seçilen oran doldurulur ve sonuç indirilebilir.

## Başlangıç

Statik bir proje olduğundan doğrudan `public/index.html` dosyasını tarayıcıda açabilirsiniz. Alternatif olarak basit bir HTTP sunucusu ile çalıştırabilirsiniz:

```bash
cd public
python -m http.server 3000
```

Ardından `http://localhost:3000` adresine gidin.

## Kullanım

1. Fotoğraf yükleyin.
2. 9:16, 4:5, 1:1 gibi standart oranlardan birini seçin.
3. **Tamamla** butonuna basın.
4. Oluşturulan görseli indirmek için **Sonucu İndir** butonunu kullanın.

## Geliştirme Notları

- Tüm işlem tarayıcıda yapılır; ek kurulum gerekmez.
- `canvas` API'si ile arka plan bulanıklaştırılarak genişletilmiş görüntü üretilir.
- İsteğe bağlı olarak sunucu ekleyip gerçek outpainting servisleriyle entegre edebilirsiniz.
