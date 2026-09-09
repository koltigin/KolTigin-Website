# ARO Network DePIN — Ubuntu / VPS Kurulum Rehberi

> Ubuntu tabanlı bilgisayarlar ve VPS sunucuları için topluluk kurulum rehberi.

ARO Network, kullanılabilir ağ ve bilgi işlem kaynaklarının merkeziyetsiz altyapıya katkı sağlamasına yönelik bir DePIN projesidir.

Bu rehber, ARO Server Node'un Ubuntu tabanlı bir bilgisayar veya VPS üzerinde kurulmasını, gerekli servislerin etkinleştirilmesini, Web Console üzerinden Device SN bilgisinin alınmasını ve node'un ARO Dashboard'a eklenmesini anlatır.

## Kayıt ve Topluluk

ARO Network'e aşağıdaki referral bağlantısı ile kayıt olabilirsiniz:

- Kayıt: https://dashboard.aro.network/signup?referral=9KAG
- Referral Code: `9KAG`
- Discord: https://discord.gg/aronetwork

## Platform Notları

- Android cihazlara kurulabilir.
- Solana Seeker üzerinde kullanılması önerilmez.
- macOS sürümü hâlâ test aşamasında olduğu için Mac üzerinde şu aşamada önerilmez.
- Ubuntu tabanlı fiziksel bilgisayarlarda çalıştırılabilir.
- Ubuntu tabanlı VPS sunucularında Server Node olarak çalıştırılabilir.

> **Önemli:** Kurulum komutlarını tek tek çalıştırın. Her satır ayrı bir komuttur.

---

## 1. ARO Kurulum Paketini İndirin

Önce `/root` dizinine geçin:

```bash
cd /root
```

ARO Network Debian kurulum paketini resmi indirme bağlantısından indirin:

```bash
wget https://download.aro.network/files/packages/linux/ARO_Desktop_latest_debian.deb
```

İndirilen dosyanın bulunduğunu kontrol edin:

```bash
ls -lh /root/ARO_Desktop_latest_debian.deb
```

Dosyaya okuma izni verin:

```bash
chmod 644 /root/ARO_Desktop_latest_debian.deb
```

---

## 2. ARO Paketini Kurun

ARO paketini kurun:

```bash
dpkg -i /root/ARO_Desktop_latest_debian.deb
```

Kurulum sırasında eksik bağımlılık uyarısı alırsanız bağımlılıkları yükleyin:

```bash
apt -f install -y
```

---

## 3. Kurulumu Doğrulayın

ARO paketinin başarıyla kurulduğunu kontrol edin:

```bash
dpkg -l | grep -i '^ii  aro'
```

Başarılı bir kurulumda aşağıdakine benzer bir çıktı görülür:

```text
ii  aro  1.0.0  all  ARO Agent
```

> Paket sürümü zaman içinde değişebileceği için sürüm numarası örnektekinden farklı olabilir.

---

## 4. Çalıştırılabilir Dosyaların İzinlerini Ayarlayın

ARO'nun kullandığı çalıştırılabilir dosyalara gerekli izinleri verin.

Komutları tek tek çalıştırın:

```bash
chmod +x /opt/src/agent/agent
```

```bash
chmod +x /opt/src/agent/updater
```

```bash
chmod +x /opt/src/agent/agent_before.sh
```

```bash
chmod +x /opt/src/rpc/frpc
```

```bash
chmod +x /opt/src/rpc/rpc_start.sh
```

```bash
chmod +x /opt/src/wx-data/.lotso/start.sh
```

```bash
chmod +x /opt/src/wx-data/.lotso/lotso
```

---

## 5. Servis Dosyalarını systemd Dizinine Kopyalayın

ARO servis dosyalarını systemd servis dizinine kopyalayın.

Komutları tek tek çalıştırın:

```bash
cp /opt/src/agent/agent.service /etc/systemd/system/
```

```bash
cp /opt/src/agent/updater.service /etc/systemd/system/
```

```bash
cp /opt/src/rpc/rpc.service /etc/systemd/system/
```

```bash
cp /opt/src/wx-data/lotso.service /etc/systemd/system/
```

---

## 6. systemd Yapılandırmasını Yenileyin

Yeni servis dosyalarının systemd tarafından algılanması için yapılandırmayı yenileyin:

```bash
systemctl daemon-reload
```

---

## 7. Servislerin Otomatik Başlamasını Etkinleştirin

ARO servislerinin sunucu veya bilgisayar yeniden başlatıldığında otomatik olarak çalışması için servisleri etkinleştirin.

```bash
systemctl enable lotso.service
```

```bash
systemctl enable updater.service
```

```bash
systemctl enable rpc.service
```

```bash
systemctl enable agent.service
```

---

## 8. ARO Servislerini Başlatın

Servisleri tek tek başlatın:

```bash
systemctl start lotso.service
```

```bash
systemctl start updater.service
```

```bash
systemctl start rpc.service
```

```bash
systemctl start agent.service
```

---

## 9. Servislerin Durumunu Kontrol Edin

Dört ARO servisinin de çalıştığını kontrol edin:

```bash
systemctl status lotso.service --no-pager
```

```bash
systemctl status rpc.service --no-pager
```

```bash
systemctl status updater.service --no-pager
```

```bash
systemctl status agent.service --no-pager
```

Çalışan servislerde aşağıdakine benzer bir durum görülmelidir:

```text
Active: active (running)
```

---

## 10. RPC Bağlantısını Kontrol Edin

RPC servisinin son loglarını görüntüleyin:

```bash
journalctl -u rpc.service -n 30 --no-pager -l
```

Sağlıklı çalışan bir bağlantıda aşağıdakilere benzer kayıtlar görülebilir:

```text
login to server success
proxy added
start proxy success
```

Bu kayıtlar RPC bağlantısının oluşturulduğunu ve proxy servisinin başlatıldığını gösterir.

---

## 11. Web Console Portunu Açın

ARO Web Console varsayılan olarak `40001/tcp` portu üzerinden erişilebilir.

UFW kullanıyorsanız ve bu port henüz açık değilse:

```bash
ufw allow 40001/tcp
```

Firewall durumunu kontrol edin:

```bash
ufw status
```

Listede `40001/tcp` için izin verildiğini doğrulayın.

> VPS sağlayıcınız ayrıca harici bir firewall veya güvenlik duvarı kullanıyorsa `40001/tcp` portuna sağlayıcı panelinden de izin vermeniz gerekebilir.

---

## 12. ARO Web Console'u Açın

Bilgisayarınızdaki tarayıcıdan aşağıdaki adresi açın:

```text
http://VPS_IP:40001
```

`VPS_IP` yerine ARO node'un çalıştığı sunucunun gerçek public IP adresini yazın.

Örnek yapı:

```text
http://203.0.113.10:40001
```

Web Console açıldığında ana sayfada cihaz ve node bilgileri görüntülenir.

---

## 13. Device SN Değerini Alın

Web Console ana sayfasında görünen:

```text
Device SN
```

değerini bulun ve kopyalayın.

Örnek Device SN:

```text
OLKN4Y76W578V19W
```

Bu değer bir sonraki adımda ARO Dashboard'a node eklemek için kullanılacaktır.

---

## 14. Doğru Seri Numarasını Kullandığınızdan Emin Olun

Bu adım önemlidir.

ARO Dashboard'a girilecek seri numarası **Web Console üzerinde gösterilen `Device SN` değeridir.**

Sistemde aşağıdaki dosya da bulunabilir:

```text
/etc/enreach/x86_sn
```

Bu dosyanın içindeki değer `STWL...` ile başlayabilir.

Örneğin:

```text
STWL...
```

Bu değer ARO Dashboard node kaydı için **kullanılmaz**.

Dashboard'a eklerken mutlaka Web Console üzerinde gösterilen:

```text
Device SN
```

değerini kullanın.

---

## 15. Node'u ARO Dashboard'a Ekleyin

ARO Dashboard'a giriş yapın.

Ardından:

1. `Add New Node` seçeneğine tıklayın.
2. Node türü olarak `Server` seçin.
3. Web Console'dan kopyaladığınız `Device SN` değerini girin.
4. `Continue` seçeneğine tıklayın.
5. Son ekranda `Location` bilgisi otomatik olarak doğru geliyorsa değiştirmeden bırakın.
6. `Add` seçeneğine tıklayarak node'u hesabınıza ekleyin.

Node başarıyla eklendiğinde ARO Dashboard üzerinden görüntülenebilir.

---

## 16. Genel Log Kontrollerini Yapın

ARO servislerinin son loglarını ayrı ayrı kontrol edebilirsiniz.

Agent:

```bash
journalctl -u agent.service -n 50 --no-pager -l
```

RPC:

```bash
journalctl -u rpc.service -n 50 --no-pager -l
```

Updater:

```bash
journalctl -u updater.service -n 50 --no-pager -l
```

Lotso:

```bash
journalctl -u lotso.service -n 50 --no-pager -l
```

Bir servisle ilgili sorun yaşarsanız ilk kontrol edilmesi gereken yerlerden biri ilgili servisin loglarıdır.

---

## 17. Canlı Log Takibi Yapın

Agent servisinin loglarını gerçek zamanlı takip etmek için:

```bash
journalctl -u agent.service -f
```

Canlı log ekranından çıkmak için:

```text
Ctrl+C
```

kullanın.

`Ctrl+C` yalnızca log görüntüleme işlemini sonlandırır; ARO servisini durdurmaz.

---

## 18. Hızlı Durum Kontrolü Yapın

Tüm ARO servislerinin aktif olup olmadığını hızlıca kontrol etmek için aşağıdaki komutları çalıştırın:

```bash
systemctl is-active lotso.service
```

```bash
systemctl is-active rpc.service
```

```bash
systemctl is-active updater.service
```

```bash
systemctl is-active agent.service
```

Dört komutun da beklenen çıktısı:

```text
active
```

olmalıdır.

---

## 19. Auto-Sleep Uyarısını Kontrol Edin

ARO aşağıdaki uyarıyı gösterebilir:

```text
Warning: Host machine OS has inappropriate auto-sleep settings.
```

Bu uyarı özellikle Windows, macOS ve Ubuntu Desktop gibi fiziksel bilgisayarlarda önemlidir.

Bilgisayar uyku moduna girerse ARO node'un çalışması durabilir. Bu nedenle fiziksel bir bilgisayarda node çalıştırıyorsanız sistemin otomatik uyku ayarlarını kapatmanız gerekir.

VPS sunucularında normal şartlarda uyku modu kullanılmaz.

VPS üzerinde bu uyarıyı görüyorsanız öncelikle servislerin gerçekten çalışıp çalışmadığını kontrol edin:

```bash
systemctl is-active lotso.service
```

```bash
systemctl is-active rpc.service
```

```bash
systemctl is-active updater.service
```

```bash
systemctl is-active agent.service
```

Dört servisin de çıktısı:

```text
active
```

ise ARO servisleri çalışmaktadır.

---

## 20. ARO Servislerini Yeniden Başlatın

Node veya servislerden biriyle ilgili sorun yaşarsanız servisleri yeniden başlatabilirsiniz.

```bash
systemctl restart lotso.service
```

```bash
systemctl restart updater.service
```

```bash
systemctl restart rpc.service
```

```bash
systemctl restart agent.service
```

Ardından durumlarını tekrar kontrol edin:

```bash
systemctl is-active lotso.service
```

```bash
systemctl is-active rpc.service
```

```bash
systemctl is-active updater.service
```

```bash
systemctl is-active agent.service
```

---

## 21. Sorun Giderme ve Son Kontrol

Agent servisiyle ilgili ayrıntılı son logları kontrol etmek için:

```bash
journalctl -u agent.service -n 100 --no-pager -l
```

RPC servisi için:

```bash
journalctl -u rpc.service -n 100 --no-pager -l
```

Updater servisi için:

```bash
journalctl -u updater.service -n 100 --no-pager -l
```

Lotso servisi için:

```bash
journalctl -u lotso.service -n 100 --no-pager -l
```

Kurulum sonunda dört servisin de aktif olduğunu doğrulayın:

```bash
systemctl is-active lotso.service
systemctl is-active rpc.service
systemctl is-active updater.service
systemctl is-active agent.service
```

Beklenen sonuç:

```text
active
active
active
active
```

RPC bağlantısını son kez kontrol etmek için:

```bash
journalctl -u rpc.service -n 30 --no-pager -l
```

Web Console'un erişilebilir olduğunu doğrulamak için tarayıcıdan:

```text
http://VPS_IP:40001
```

adresini açın.

Node'un ARO Dashboard üzerinde kayıtlı ve çevrimiçi olduğunu da kontrol edin.

---

## Kurulum Özeti

Kurulum tamamlandığında aşağıdaki dört servis çalışıyor olmalıdır:

```text
lotso.service
rpc.service
updater.service
agent.service
```

Web Console:

```text
http://VPS_IP:40001
```

Dashboard kaydında kullanılacak seri numarası:

```text
Web Console → Device SN
```

Dashboard kaydında **kullanılmaması gereken** değer:

```text
/etc/enreach/x86_sn → STWL...
```

---

## Topluluk Rehberi Notu

Bu rehber topluluk deneyimine dayalı olarak hazırlanmıştır ve resmi ARO Network dokümantasyonu değildir.

ARO Network tarafından paket sürümü, dosya yolları, servis adları veya kurulum yöntemi değiştirilirse rehberdeki bazı komutların güncellenmesi gerekebilir.
