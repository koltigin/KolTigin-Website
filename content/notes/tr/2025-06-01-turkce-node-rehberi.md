---
title: "Node rehberi yazarken dikkat ettiğim üç temel kural"
date: 2025-06-01
---

Bir node kurulum rehberinin amacı yalnızca birkaç terminal komutunu sıralamak değildir. Rehberi kullanan kişinin, projeyi daha önce hiç kurmamış olsa bile, adımları takip ederek çalışan ve gerektiğinde yönetebileceği bir node'a ulaşabilmesi gerekir.

Yıllardır farklı mainnet, testnet ve node altyapılarıyla çalışırken rehberlerde özellikle üç konuya dikkat etmeye başladım.

## 1. Komutlar yazıldığı haliyle çalışmalı

Bir rehberde verdiğim komutun, kullanıcının tahmin yürütmesine gerek kalmadan çalışmasını isterim.

Örneğin bir paket kurulacaksa yalnızca paket adını vermek yerine gerekli repository, bağımlılıklar ve kurulum sırası da açık olmalıdır. Bir servis oluşturulacaksa dosyanın nereye kaydedileceği, hangi kullanıcıyla çalışacağı ve servisin nasıl başlatılacağı belirtilmelidir.

Aynı şey dizinler, environment variable'lar ve dosya izinleri için de geçerlidir.

Benim için iyi bir rehberin temel testi basittir:

Komutu kopyaladığımda ne olacağını biliyor muyum?

Cevap hayırsa o adım yeterince açık değildir.

## 2. Sürüm ve kaynak bilgisi açık olmalı

Node yazılımları sürekli değişir. Bugün çalışan bir komut birkaç ay sonra eski bir binary, değiştirilmiş repository veya yeni bir yapılandırma nedeniyle çalışmayabilir.

Bu nedenle mümkün olduğunda kullandığım binary sürümünü, resmi repository'yi, gerekli portları ve önemli yapılandırma değerlerini açıkça belirtmeye çalışırım.

Özellikle güncelleme rehberlerinde bu daha da önemlidir.

Bir node operatörü hangi sürümden hangi sürüme geçtiğini ve kullandığı binary'nin nereden geldiğini bilmelidir.

Rehber eski kaldığında da bunun anlaşılabilmesi gerekir. Tarih ve sürüm bilgisi bu yüzden yalnızca ayrıntı değildir. Teknik dokümantasyonun bir parçasıdır.

## 3. Sadece başarılı kurulumu anlatmamak gerekir

Gerçek hayatta kurulumlar her zaman rehberdeki gibi ilerlemez.

Port kullanımda olabilir. Servis başlamayabilir. Disk dolabilir. Binary yanlış dizinde olabilir. Bir yapılandırma dosyasının izinleri bozulabilir veya node senkronizasyonda takılabilir.

Bu nedenle karşılaştığım önemli hataları mümkün olduğunca rehberlere eklemeyi tercih ederim.

Özellikle şu üç bilgiyi vermeye çalışırım:

- Hatanın nasıl anlaşılacağı
- Muhtemel nedeninin ne olduğu
- Güvenli şekilde nasıl düzeltileceği

Bazen bir hata mesajı, başarılı kurulum komutundan daha değerlidir. Çünkü node'u kurmak genellikle bir kez yapılan iştir. Sorun çözmek ise operatörlüğün sürekli bir parçasıdır.

## Sonuç

Benim için iyi bir node rehberi kısa veya uzun olmasıyla değil, belirsizliği ne kadar azalttığıyla ölçülür.

Komutlar çalışmalı, kullanılan sürüm ve kaynak açık olmalı, sorun çıktığında kullanıcı ne yapacağını anlayabilmelidir.

Bir rehberi hazırlarken hedefim yalnızca node'u çalıştırmak değil, rehberi takip eden kişinin kurduğu sistemi anlayabilmesini sağlamaktır.
