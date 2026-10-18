# Packet Tracer 장애 해결 실습 5개

작성일: 2026-10-18. 직접 구성하고 문제를 재현하도록 설계한 실습안입니다. 실제 Packet Tracer에서 실행 검증한 .pkt 파일은 아닙니다. Cisco 2911 두 대와 2960-24TT 두 대의 인터페이스명을 기준으로 작성했습니다.

## 진행 방법

정상 구성 → 정상 확인 → BASELINE.pkt 저장 → 매 사례마다 BASELINE을 다시 열고 Save As로 CASE-01.pkt 등의 사본 생성 → 장애 하나 주입 → 진단·복구·재검증 순서입니다. 이전 사례의 장애를 남겨두지 마세요. 정상 상태는 모든 PC의 VLAN 간 통신과 서버 HTTP 접근을 허용하는 교육용 기준입니다. 실제 보안 정책 예제와는 구분하세요.

처음에는 답을 보며 따라하고, 두 번째에는 복구 부분을 가리고 증상과 진단 명령으로 원인을 설명해 보세요. 권장 분량은 첫날 정상 구성, 이후 하루 한 사례입니다.

## 0. 장비와 배선

장비: Router 2911 ×2(R1/R2), Switch 2960-24TT ×2(SW1/SW2), PC-PT ×3(PC-A/B/C), Server-PT ×1(WEB).

```text
PC-A -- SW1 --(trunk)-- R1 ---- R2 -- SW2 -- WEB
PC-B -- SW1
PC-C -- SW1
```

| 연결 | 케이블 |
|---|---|
| PC-A FastEthernet0 ↔ SW1 Fa0/1 | Copper Straight-Through |
| PC-B FastEthernet0 ↔ SW1 Fa0/2 | Copper Straight-Through |
| PC-C FastEthernet0 ↔ SW1 Fa0/3 | Copper Straight-Through |
| SW1 Gi0/1 ↔ R1 Gi0/0 | Copper Straight-Through |
| R1 Gi0/1 ↔ R2 Gi0/0 | Copper Cross-Over |
| R2 Gi0/1 ↔ SW2 Fa0/2 | Copper Straight-Through |
| WEB FastEthernet0 ↔ SW2 Fa0/1 | Copper Straight-Through |

## 1. 주소 계획

| 장비 | IP / 마스크 | 기본 게이트웨이 |
|---|---|---|
| PC-A (VLAN 10) | 192.168.10.11 / 255.255.255.0 | 192.168.10.1 |
| PC-B (VLAN 20) | 192.168.20.11 / 255.255.255.0 | 192.168.20.1 |
| PC-C (VLAN 10) | DHCP: 192.168.10.100~199 | DHCP로 192.168.10.1 |
| R1 Gi0/0.10 | 192.168.10.1 / 255.255.255.0 | 해당 없음 |
| R1 Gi0/0.20 | 192.168.20.1 / 255.255.255.0 | 해당 없음 |
| R1 Gi0/1 | 10.255.12.1 / 255.255.255.252 | 해당 없음 |
| R2 Gi0/0 | 10.255.12.2 / 255.255.255.252 | 해당 없음 |
| R2 Gi0/1 | 172.16.50.1 / 255.255.255.0 | 해당 없음 |
| WEB | 172.16.50.10 / 255.255.255.0 | 172.16.50.1 |

두 스위치의 관리 IP는 이 실습에서 필요 없습니다. DNS도 사용하지 않으며 웹 접속은 IP로 합니다. R1의 하나의 물리 포트가 VLAN 10/20을 서브인터페이스로 나누어 라우팅합니다. R2가 원격 DHCP 서버 역할도 합니다.

## 2. 정상 구성

각 장비 → CLI에서 처음 설정 대화상자가 나오면 no를 입력하고 Enter로 시작합니다. 아래 명령에는 프롬프트(R1# 등)를 포함하지 않았습니다. 첫 구성은 새 장비에서 합니다. 마지막 copy 명령의 Destination filename 질문에는 Enter를 누르세요. show 명령은 # 모드에서 실행하고, 설정 모드라면 end로 빠져나오세요. --More--에서는 Space로 다음 화면을 봅니다. % Invalid input이 나오면 해당 줄과 장비·포트명을 확인한 뒤 진행하세요.

### SW1

```text
enable
configure terminal
hostname SW1
vlan 10
 name USERS10
exit
vlan 20
 name USERS20
exit
interface fastEthernet0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
exit
interface fastEthernet0/2
 switchport mode access
 switchport access vlan 20
 spanning-tree portfast
exit
interface fastEthernet0/3
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
exit
interface gigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 no shutdown
exit
end
copy running-config startup-config
```

### SW2

```text
enable
configure terminal
hostname SW2
interface fastEthernet0/1
 switchport mode access
 switchport access vlan 1
 spanning-tree portfast
 no shutdown
exit
interface fastEthernet0/2
 switchport mode access
 switchport access vlan 1
 spanning-tree portfast
 no shutdown
exit
end
copy running-config startup-config
```

### R1

```text
enable
configure terminal
hostname R1
interface gigabitEthernet0/0
 no ip address
 no shutdown
exit
interface gigabitEthernet0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.1 255.255.255.0
 ip helper-address 10.255.12.2
exit
interface gigabitEthernet0/0.20
 encapsulation dot1Q 20
 ip address 192.168.20.1 255.255.255.0
exit
interface gigabitEthernet0/1
 ip address 10.255.12.1 255.255.255.252
 no shutdown
exit
ip route 172.16.50.0 255.255.255.0 10.255.12.2
end
copy running-config startup-config
```

### R2

```text
enable
configure terminal
hostname R2
service dhcp
interface gigabitEthernet0/0
 ip address 10.255.12.2 255.255.255.252
 no shutdown
exit
interface gigabitEthernet0/1
 ip address 172.16.50.1 255.255.255.0
 no shutdown
exit
ip route 192.168.10.0 255.255.255.0 10.255.12.1
ip route 192.168.20.0 255.255.255.0 10.255.12.1
ip dhcp excluded-address 192.168.10.1 192.168.10.99
ip dhcp excluded-address 192.168.10.200 192.168.10.254
ip dhcp pool USERS10
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.1
exit
end
copy running-config startup-config
```

### PC·서버 설정

1. PC-A와 PC-B를 각각 클릭 → Desktop → IP Configuration → Static → 주소표대로 IP/Subnet Mask/Default Gateway 입력.
2. WEB → Desktop → IP Configuration → Static → 주소표 입력. Services → HTTP → On 확인. DNS·DHCP 서비스는 이 서버에서 사용하지 않습니다.
3. 네 라우터/스위치 설정을 마친 뒤 PC-C → Desktop → IP Configuration → DHCP 클릭.
4. PC-C → Desktop → Command Prompt → ipconfig 실행. 192.168.10.100~199, /24, gateway 192.168.10.1인지 확인. 정확한 끝자리 주소는 고정하지 않습니다.

## 3. 정상 확인 후 기준 파일 저장

1. SW1: show vlan brief → Fa0/1·Fa0/3은 VLAN 10, Fa0/2는 VLAN 20.
2. SW1: show interfaces trunk → Gi0/1은 trunking, 허용 VLAN은 10,20. trunk 포트는 show vlan brief의 access port 목록에 나오지 않을 수 있습니다.
3. R1/R2: show ip interface brief → 연결한 물리 포트와 R1의 서브인터페이스가 up/up.
4. R1: show ip route → 172.16.50.0/24 정적 경로 확인. R2: show ip route → 192.168.10.0/24·192.168.20.0/24 정적 경로 확인.
5. R2: show ip dhcp binding → PC-C의 임대 확인.
6. PC-A에서 ping 192.168.10.1, ping 192.168.20.11, ping 172.16.50.10 성공 확인. PC-B·PC-C에서도 자기 gateway와 서버 ping 성공 확인.
7. 세 PC 각각 Desktop → Web Browser → http://172.16.50.10 → Go → 페이지 표시 확인.
8. 링크가 초록색이 되고 수렴할 때까지 기다립니다. 첫 ping의 일부만 ARP 학습으로 실패할 수 있으므로 한 번 더 확인하세요. 계속 실패하면 정상 기준이 완성되지 않은 것입니다.
9. File → Save As → BASELINE.pkt 저장. 이후 실습은 반드시 이 파일의 사본에서 합니다. copy running-config startup-config와 .pkt 파일 저장은 서로 다른 작업입니다.

## 사례 1. VLAN 20 사용자만 통신 불가 — trunk 허용 VLAN 누락

### A. 장애 넣기 — SW1

```text
enable
configure terminal
interface gigabitEthernet0/1
 switchport trunk allowed vlan 10
end
```

### B. 예상 증상

PC-B는 192.168.20.1과 서버에 ping 실패. PC-A는 게이트웨이·서버 통신 성공.

### C. 직접 진단

1. PC-B의 Desktop → Command Prompt에서 ipconfig로 192.168.20.11/24와 게이트웨이 192.168.20.1을 확인합니다.
2. PC-B에서 ping 192.168.20.1, ping 172.16.50.10을 실행합니다.
3. PC-A에서 서버 ping이 되는지 비교합니다. 전체 서버 장애보다는 VLAN 20 경로 문제를 먼저 의심합니다.
4. SW1에서 show vlan brief로 VLAN 20과 Fa0/2 소속을 확인합니다.
5. SW1에서 show interfaces trunk를 실행합니다. Gi0/1의 Vlans allowed on trunk에 10만 있는 것이 결정적 증거입니다.
6. R1의 show ip interface brief로 서브인터페이스 상태도 비교합니다. up/up만으로 해당 VLAN의 데이터 통신이 보장되지는 않습니다.

### D. 복구 — SW1

```text
enable
configure terminal
interface gigabitEthernet0/1
 switchport trunk allowed vlan 10,20
end
```

### E. 완료 기준

PC-B에서 게이트웨이·서버 ping과 http://172.16.50.10 접속 성공. PC-A도 계속 성공.

**배울 점:** VLAN 생성 여부와 trunk 통과 허용 여부는 서로 다른 조건입니다.

**보고서 예시:** VLAN 20의 access port 구성은 정상이었으나, uplink trunk에서 VLAN 20이 허용되지 않았다. 허용 목록을 복구한 뒤 게이트웨이·서버 통신을 확인했다.

복구 전·후의 관련 설정/결과를 기록하고 CASE-01-FIXED.pkt로 저장하세요. 다음 사례는 BASELINE.pkt를 다시 열어 시작합니다.

## 사례 2. PC-A만 외부 네트워크 접속 불가 — 기본 게이트웨이 오류

### A. 장애 넣기 — PC-A

Desktop → IP Configuration → Static에서 Default Gateway만 192.168.10.254로 변경합니다. IP·마스크는 그대로 둡니다.

### B. 예상 증상

PC-A는 같은 VLAN의 PC-C와 192.168.10.1에 ping 성공. VLAN 20의 PC-B와 서버에는 실패. PC-B·PC-C는 정상.

### C. 직접 진단

1. PC-C에서 ipconfig를 실행해 현재 DHCP 주소를 적어둡니다.
2. PC-A에서 PC-C의 실제 주소와 192.168.10.1에 ping합니다.
3. 이어서 192.168.20.11과 172.16.50.10에 ping합니다.
4. 같은 대역은 성공하지만 다른 대역만 실패하면 PC의 마스크·기본 게이트웨이를 확인합니다.
5. PC-A의 ipconfig에서 Default Gateway가 주소 계획의 192.168.10.1과 다른 것을 확인합니다.
6. 192.168.10.1 자체는 같은 /24 대역이므로, 잘못된 기본 게이트웨이가 있어도 직접 ARP로 찾아 통신할 수 있습니다. 게이트웨이 ping 성공만으로 PC의 gateway 설정이 옳다고 판단하지 마세요.

### D. 복구 — PC-A

Desktop → IP Configuration에서 Default Gateway를 192.168.10.1로 복구합니다.

### E. 완료 기준

PC-A에서 PC-C·192.168.20.11·서버 ping 성공. 서버 웹 접속 성공.

**배울 점:** 같은 서브넷의 통신과 다른 서브넷으로 나가는 통신은 경로 선택이 다릅니다.

**보고서 예시:** PC-A의 기본 게이트웨이가 미사용 주소로 설정되어 같은 서브넷 통신만 가능했다. 올바른 게이트웨이로 수정 후 다른 VLAN과 서버 접속을 검증했다.

복구 전·후의 관련 설정/결과를 기록하고 CASE-02-FIXED.pkt로 저장하세요. 다음 사례는 BASELINE.pkt를 다시 열어 시작합니다.

## 사례 3. VLAN 10에서 서버 접속 불가 — 돌아오는 정적 경로 누락

### A. 장애 넣기 — R2

```text
enable
configure terminal
no ip route 192.168.10.0 255.255.255.0 10.255.12.1
end
```

### B. 예상 증상

PC-A는 자기 게이트웨이와 PC-B에 ping 성공하지만 서버에 실패. PC-B는 서버에 성공. PC-C도 VLAN 10이므로 서버 통신이 영향을 받으며, DHCP 갱신도 실패할 수 있습니다.

### C. 직접 진단

1. PC-A에서 ping 192.168.10.1, ping 192.168.20.11, ping 172.16.50.10 순으로 확인합니다.
2. PC-B에서도 서버 ping을 해 서버가 살아 있는지 비교합니다.
3. R1에서 show ip route를 확인합니다. 172.16.50.0/24 정적 경로가 있는지 봅니다.
4. R2에서 show ip route를 확인합니다. 192.168.20.0/24 경로는 있지만 192.168.10.0/24 경로가 없는지 봅니다.
5. R1에서 ping 172.16.50.10을 실행해 PC-A의 결과와 비교합니다. 기본 ping은 일반적으로 나가는 인터페이스의 10.255.12.1을 출발지로 사용하므로 성공할 수 있습니다.
6. Simulation 모드에서 ICMP를 선택하고 PC-A의 ping을 따라가면, 요청·응답 중 어느 방향이 막히는지 확인할 수 있습니다.

### D. 복구 — R2

```text
enable
configure terminal
ip route 192.168.10.0 255.255.255.0 10.255.12.1
end
```

### E. 완료 기준

R2의 route table에 VLAN 10 경로 복구. PC-A·PC-B·PC-C의 서버 ping 성공. PC-C DHCP 재갱신 성공.

**배울 점:** 요청이 서버에 도달하는 경로와 응답이 사용자에게 돌아오는 경로를 모두 확인해야 합니다. 라우터 자신의 ping 성공은 사용자 경로 전체의 성공을 뜻하지 않습니다.

**보고서 예시:** R1의 서버 방향 경로는 정상이었으나 R2의 VLAN 10 반환 경로가 누락되어 응답을 전달하지 못했다. 반환 경로를 복구하고 사용자 출발지 기준으로 통신을 재검증했다.

복구 전·후의 관련 설정/결과를 기록하고 CASE-03-FIXED.pkt로 저장하세요. 다음 사례는 BASELINE.pkt를 다시 열어 시작합니다.

## 사례 4. PC-C가 IP를 못 받음 — DHCP relay 누락

### A. 장애 넣기 — R1

```text
enable
configure terminal
interface gigabitEthernet0/0.10
 no ip helper-address 10.255.12.2
end
```

### B. 예상 증상

기존 주소가 남아 있으면 장애가 숨겨집니다. PC-C에서 임대를 해제하고 새로 요청하면 DHCP 주소를 받지 못합니다. 정적 주소를 쓰는 PC-A·PC-B의 서버 통신은 정상입니다.

### C. 직접 진단

1. PC-C가 DHCP 선택 상태인지 확인합니다. Desktop → Command Prompt에서 ipconfig /release 다음 ipconfig /renew를 실행합니다. 갱신 결과와 ipconfig를 확인하세요. 유효한 192.168.10.100~199 주소를 받지 못하며 표시 주소·오류 문구는 버전에 따라 다를 수 있습니다.
2. PC-A에서 서버 ping과 웹 접속을 확인합니다. 일반적인 VLAN 10 라우팅 자체는 살아 있습니다.
3. R2에서 show ip dhcp pool, show ip dhcp binding, show running-config로 pool·잔여 주소·network·default-router를 확인합니다. 이전 binding이 있다고 새 요청도 성공한 것은 아닙니다.
4. R1에서 show running-config를 실행해 Gi0/0.10의 helper 설정이 빠졌는지 확인합니다. 화면이 --More--에서 멈추면 Space로 계속 봅니다.
5. Simulation에서 DHCP를 선택해 PC-C의 주소 요청을 봅니다. 클라이언트의 브로드캐스트를 원격 DHCP 서버로 중계하는 부분을 확인하세요.

### D. 복구 — R1

```text
enable
configure terminal
interface gigabitEthernet0/0.10
 ip helper-address 10.255.12.2
end
```

### E. 완료 기준

PC-C에서 ipconfig /renew를 다시 실행. 192.168.10.100~199, 마스크 255.255.255.0, gateway 192.168.10.1을 받고 서버 통신 성공.

**배울 점:** 서로 다른 서브넷의 DHCP 서버를 이용할 때는 relay가 필요합니다. 이 랩에서는 사용자 VLAN의 R1 서브인터페이스에 helper를 둡니다.

**보고서 예시:** 정적 IP 사용자는 정상이나 DHCP 클라이언트의 신규 주소 요청만 실패했다. 사용자 VLAN 인터페이스의 relay 누락을 복구한 뒤 임대 정보와 실제 서비스 접근을 확인했다.

복구 전·후의 관련 설정/결과를 기록하고 CASE-04-FIXED.pkt로 저장하세요. 다음 사례는 BASELINE.pkt를 다시 열어 시작합니다.

## 사례 5. ping은 되는데 웹만 안 됨 — TCP 80 ACL 차단

### A. 장애 넣기 — R1

```text
enable
configure terminal
access-list 100 deny tcp 192.168.10.0 0.0.0.255 host 172.16.50.10 eq 80
access-list 100 permit ip any any
interface gigabitEthernet0/0.10
 ip access-group 100 in
end
```

### B. 예상 증상

PC-A·PC-C는 서버 ping 성공, HTTP 접속 실패. PC-B의 서버 웹 접속은 성공.

### C. 직접 진단

1. PC-A에서 ping 172.16.50.10을 확인합니다.
2. PC-A의 Desktop → Web Browser에서 http://172.16.50.10을 열어 실패를 확인합니다. https가 아닌 http를 사용하세요.
3. PC-B에서도 같은 URL에 접속합니다. PC-B에서 성공하면 서버 HTTP 서비스 자체의 장애 가능성은 낮아집니다. Server의 Services → HTTP → On도 확인합니다.
4. R1에서 show access-lists, show ip interface gigabitEthernet0/0.10을 실행합니다. 번호 100의 TCP 목적지 80 deny와 inbound 적용을 확인합니다. 필요하면 show running-config로도 확인하세요.
5. Simulation에서 TCP·HTTP를 선택하고 새 웹 접속을 시도해 차단되는 위치를 확인합니다. ACL counter 지원·표시 방식은 Packet Tracer 버전에 따라 다를 수 있으므로 고정된 카운터 값을 예상하지 마세요.

### D. 복구 — R1

```text
enable
configure terminal
interface gigabitEthernet0/0.10
 no ip access-group 100 in
exit
no access-list 100
end
```

### E. 완료 기준

PC-A·PC-C의 HTTP와 ping 모두 성공. PC-B도 그대로 성공. 정상 기준인 ‘세 PC 모두 HTTP 허용’으로 돌아왔는지 확인.

**배울 점:** ping은 ICMP를 확인하는 검사입니다. TCP 80 서비스의 접근 가능 여부는 별도로 검증해야 합니다. ACL은 위에서 아래로 첫 일치 규칙을 적용하므로 뒤의 permit ip any any가 앞의 HTTP deny를 취소하지 않습니다.

**보고서 예시:** 네트워크 도달성은 정상이었으나 사용자 VLAN inbound ACL이 서버 TCP 80을 차단했다. 잘못 적용된 랩 ACL을 제거한 뒤 HTTP 접속과 비영향 VLAN의 정상 상태까지 확인했다.

복구 전·후의 관련 설정/결과를 기록하고 CASE-05-FIXED.pkt로 저장하세요. 다음 사례는 BASELINE.pkt를 다시 열어 시작합니다.

## 공통 진단 순서

영향 범위 비교 → PC 주소·마스크·게이트웨이 → 연결·VLAN·trunk → 양방향 route → DHCP 또는 ACL·서비스 순으로 좁힙니다. 모든 show 출력 전체를 무작정 모으기보다 각 가설을 지지하거나 배제할 증거를 찾으세요.

| 사례 | 핵심 증거 | 면접에서 설명할 질문 |
|---|---|---|
| 1. VLAN | trunk 허용 목록에 20 누락 | VLAN이 존재하는데 왜 통신이 안 되는가? |
| 2. Gateway | PC의 gateway만 주소 계획과 다름 | 왜 같은 대역과 라우터 IP ping은 성공하는가? |
| 3. Return route | R2에 VLAN 10 경로 누락 | 왜 R1의 ping 성공이 PC-A 통신 성공을 뜻하지 않는가? |
| 4. DHCP relay | 정적 IP 정상, 신규 DHCP 실패, helper 누락 | DHCP 서버가 다른 대역에 있으면 무엇이 필요한가? |
| 5. ACL | ICMP 성공, TCP 80 deny와 inbound 적용 | 왜 ping만으로 웹 서비스를 검증할 수 없는가? |

## 직접 채울 보고서

- 사례/날짜:
- 증상과 영향 범위:
- 첫 번째 가설:
- 실행한 명령/관찰한 패킷:
- 가설을 지지하거나 배제한 증거:
- 근본 원인:
- 변경한 내용:
- 복구 후 검증(문제 사용자 + 정상 사용자):
- 재발 방지:
- 영어 설명 3문장:

I observed ...
I checked ... and found ...
After ..., I verified ...

## Cisco 원리·명령 확인 자료

- [trunk 상태·허용 VLAN 확인](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst4500/XE3-11-0E/command/reference/xe-311-cmd/show1.html)
- [정적 경로 ip route 명령](https://www.cisco.com/c/en/us/td/docs/ios/iproute_pi/command/reference/iri_book/iri_pi1.html)
- [DHCP relay와 ip helper-address](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr_dhcp/configuration/12-4/dhcp-12-4-book/config-dhcp-relay-agent.html)
- [ACL 첫 일치 규칙과 implicit deny](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/security-vpn/security-vpn/m_sec-acl-named.html)
- [Cisco Packet Tracer: PC의 DHCP release/renew](https://contenthub.netacad.com/legacy/I2IoT/2.0/en/course/files/1.1.2.5%20Packet%20Tracer%20-%20Create%20a%20Simple%20%20Network%20Using%20Packet%20Tracer.pdf)

