export const scenes = [
  {
    place: "동네 카페", time: "토요일 · 오후 2:10", title: "아아 한 잔, 명함 한 장",
    image: "cafe.jpg", alt: "카페 테이블 너머에서 모자를 쓴 남자가 커피 옆에 명함을 내려놓는다.",
    followPhoto: {image: "cafe-follow.jpg", alt: "명함을 가리키며 다시 연락처를 묻는 카페 손님."},
    resultPhoto: {image: "cafe-result.jpg", alt: "커피잔 옆 테이블에 놓인 하얀 명함."},
    setup: "옆자리 손님이 콘센트 위치를 묻더니, 이번엔 테이블 위로 명함을 밀어 놓는다.",
    speaker: "옆자리 손님", line: "나 원래 먼저 연락처 안 주는데. 여기 내 비공개 계정도 있어요. 오늘 안 찍으면 손해.",
    choices: [
      {text: "괜찮아요. 저는 연락처 교환 안 할게요.", outcome: "clear", feedback: "명함은 테이블에 남고, 내 커피는 끝까지 내 것이었다."},
      {text: "지금은 커피가 식어서요. 나중에 볼게요.", outcome: "retry", feedback: "상대는 ‘나중에’를 일정 조율로 받아들였다."},
      {text: "그럼 제 번호도 적어 드릴게요.", outcome: "miss", feedback: "원치 않았던 연락 창구가 하나 생겼다. 명함은 받지 않고 자리를 옮길 수도 있었다."}
    ],
    followup: {
      line: "그럼 다 마시고요. 저도 기다리는 건 잘해요. 저장부터 할까요?",
      choices: [
        {text: "아, 몇 분만요. 커피 거의 다 마셨어요.", outcome: "miss", feedback: "거절이 또 한 번 대기 시간으로 바뀌었다."},
        {text: "연락처는 주고받지 않을게요. 먼저 일어날게요.", outcome: "clear", feedback: "시간 얘기를 끝내고 원하는 바를 말하니 대화도 끝났다."},
        {text: "제 번호 말고 SNS 아이디만 줄게요.", outcome: "miss", feedback: "전화번호 대신 다른 연락처를 넘겼다. 불편하다면 둘 다 줄 필요 없다."}
      ]
    }
  },
  {
    place: "회사 회식", time: "목요일 · 오후 9:05", title: "2차는 팀 전체 아니었나요?",
    image: "office.jpg", alt: "회식 자리에서 데님 재킷을 입은 선배가 출입구 쪽을 손짓한다.",
    followPhoto: {image: "office-follow.jpg", alt: "회식 자리에서 선배가 손가락을 입에 대며 비밀이라고 한다."},
    resultPhoto: {image: "office-result.jpg", alt: "저녁 회식이 끝나 가는 식당에서 동료들이 짐을 챙긴다."},
    setup: "계산서가 오자 선배가 동료들 눈치를 보고 의자를 가까이 당긴다.",
    speaker: "회사 선배", line: "2차는 우리 둘만 가자. 내 위스키 바 단골 자리, 후배한테 공개하는 거 처음이야.",
    choices: [
      {text: "다른 분들 먼저 보내고 어디 갈지 정하죠.", outcome: "miss", feedback: "둘만 남자는 전제를 받아들였다. 합류 여부는 각자 정해도 된다."},
      {text: "오늘은 체력이 좀… 다들 어떻게 하시려나.", outcome: "retry", feedback: "선배가 짧게 들렀다 가는 걸로 일정을 다시 짜기 시작했다."},
      {text: "저는 여기까지만 할게요. 지은 씨, 같이 역까지 가요.", outcome: "clear", feedback: "합류하지 않겠다고 말하고 동료와 먼저 나왔다. 2차 대신 막차를 잡았다."}
    ],
    followup: {
      line: "그럼 딱 한 잔만. 다른 사람들한텐 비밀로 하자. 내일 출근 늦어도 내가 커버해 줄게.",
      choices: [
        {text: "저는 따로 안 갈게요. 동료들과 같이 나가겠습니다.", outcome: "clear", feedback: "비밀 약속도, 출근 시간 거래도 생기지 않았다."},
        {text: "그럼 진짜 한 잔만 마실게요.", outcome: "miss", feedback: "한 잔으로 줄었지만, 원치 않던 2차는 그대로였다."},
        {text: "바는 부담스러우니 둘이 카페만 가죠.", outcome: "miss", feedback: "장소를 바꿨지만 원치 않던 단둘의 약속은 그대로였다."}
      ]
    }
  },
  {
    place: "한강 러닝 크루", time: "수요일 · 오후 7:32", title: "페이스가 아니라 사생활",
    image: "running.jpg", alt: "해 질 무렵 한강 산책로에서 주황색 재킷을 입은 크루장이 휴대폰을 들어 보인다.",
    followPhoto: {image: "running-follow.jpg", alt: "한강 산책로에서 크루장이 휴대폰을 확인하며 이야기를 이어 간다."},
    resultPhoto: {image: "running-result.jpg", alt: "러닝을 마친 사람들이 다리 조명이 비치는 한강 길을 걸어간다."},
    setup: "첫 단체 러닝을 마쳤다. 스트레칭을 하는데 크루장이 휴대폰을 들어 보인다.",
    speaker: "크루장", line: "페이스 좋던데? 내가 DM으로 매일 관리해 줄게. 오늘부터 굿나잇 루틴도 가능.",
    choices: [
      {text: "훈련 일정은 단톡에만 올려 주세요. 개인 연락은 받지 않을게요.", outcome: "clear", feedback: "러닝은 계속하고 연락 채널은 공개된 곳에 뒀다."},
      {text: "일단 DM 열어 둘게요. 밤에는 답장 잘 못해요.", outcome: "retry", feedback: "상대는 답장 가능한 시간만 조정하면 된다고 생각했다."},
      {text: "매일 밤 운동 끝나면 제가 먼저 DM 보낼게요.", outcome: "miss", feedback: "원하지 않던 연락이 일과표에 들어왔다. 단체 운동은 단톡만으로도 가능하다."}
    ],
    followup: {
      line: "그럼 새벽도 괜찮아. 아침 체중이랑 집 근처 코스도 보내 줘. 너만 따로 봐줄게.",
      choices: [
        {text: "체중만 빼고 집 근처 코스는 보낼게요.", outcome: "miss", feedback: "상대가 요구한 사적인 정보 중 일부를 넘기게 됐다."},
        {text: "집 근처 코스 대신 언제 혼자 뛰는지만 알려줄게요.", outcome: "miss", feedback: "장소 대신 혼자 다니는 시간을 알려줬다. 운동 정보도 필요한 만큼만 나눌 수 있다."},
        {text: "개인 정보는 공유하지 않을게요. 계속 연락이 오면 운영진에게 알릴게요.", outcome: "clear", feedback: "대화를 종료하고 필요하면 도움을 요청할 수 있는 길을 확보했다."}
      ]
    }
  },
  {
    place: "원데이 클래스 입구", time: "금요일 · 오후 8:46", title: "우산 하나, 출구는 두 개",
    image: "exit.jpg", alt: "비 오는 밤 건물 입구에서 우산을 든 남자가 주차장을 가리키고, 뒤로 밝은 로비가 보인다.",
    followPhoto: {image: "exit-follow.jpg", alt: "우산을 기울인 수강생과 뒤편의 밝은 로비, 멀리 켜진 차량 불빛."},
    resultPhoto: {image: "exit-result.jpg", alt: "빗물에 불빛이 반사되는 건물 앞. 밝은 로비와 어두운 주차장이 보인다."},
    setup: "수업이 끝나고 갑자기 비가 쏟아진다. 밝은 로비에는 아직 직원이 남아 있다.",
    speaker: "같은 반 수강생", line: "택시 기다릴 필요 없어요. 집 앞까지 쏴 줄게. 어차피 가는 길인데 주소만 찍어요.",
    choices: [
      {text: "그럼 집 앞 골목까지 부탁할게요.", outcome: "miss", feedback: "원하지 않던 차편을 수락하고 집 위치도 알려주게 됐다."},
      {text: "괜찮아요. 저는 로비에서 제 차편 기다릴게요.", outcome: "clear", feedback: "익숙한 공간으로 돌아가 내가 고른 차편으로 귀가했다."},
      {text: "아직 택시 잡아 보고요. 안 잡히면 말씀드릴게요.", outcome: "retry", feedback: "상대는 택시가 안 잡히기를 기다리며 입구에 그대로 남았다."}
    ],
    followup: {
      line: "벌써 차 시동 걸어 놨는데? 일단 우산 쓰고 주차장까지 같이 가요.",
      choices: [
        {text: "차는 타지 않을게요. 로비로 돌아가 직원에게 도움을 요청할게요.", outcome: "clear", feedback: "설득을 더 듣기보다 사람이 있는 곳으로 옮겼다."},
        {text: "일단 차 있는 데까지만 같이 갈게요.", outcome: "miss", feedback: "원래 대기하던 밝은 로비에서 멀어졌다."},
        {text: "미안하니까 집 주소라도 먼저 알려드릴게요.", outcome: "miss", feedback: "상대가 시동을 걸었다고 해서 주소를 알려줄 의무는 없다."}
      ]
    }
  }
];
