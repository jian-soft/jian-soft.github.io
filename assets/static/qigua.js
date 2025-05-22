var YANG = '|';
var YIN = '||';
var Liushen = ["青", "朱", "勾", "螣", "虎", "玄"];
var Qigua = {
	string01ArrayToValue: function(string01Array){
		var string01 = '';

		for (var i = 0; i < 6; i++){
			string01 += string01Array[i];
		}

		return parseInt(string01, 2);
	},

	yinYangArrayToValue: function(yinYangArray){
		var string01Array = [];

		for (var i = 0; i < 6; i++){
			if (yinYangArray[i] === YIN){
				string01Array[i] = '0';
			} else if (yinYangArray[i] === YANG){
				string01Array[i] = '1';
			} else{
				alert('yinYangArrayToValue: yinYangArray[' + i +'] is error: '+yinYangArray[i]);
				string01Array[i] = '1';
			}
		}

		return Qigua.string01ArrayToValue(string01Array);
	},

	yinYangSwitch: function(yinYang){
		var ret;
		if (yinYang === YANG){
			ret = YIN;
		} else if (yinYang === YIN){
			ret = YANG;
		} else{
			alert('yinYangSwitch: input param yinYang is error: '+yinYang);
			ret = YANG;
		}
		return ret;
	},

	liuqinFromLiuyao: function(a, b){
		if(a === b){
    	    return "兄";
		}
    	else if((a === "金" && b === "水") ||
    			(a === "水" && b === "木") ||
    			(a === "木" && b === "火") ||
    			(a === "火" && b === "土") ||
    			(a === "土" && b === "金"))
    		return "孙";    
    	else if((a === "金" && b === "木") ||
        		(a === "水" && b === "火") ||
        		(a === "木" && b === "土") ||
        		(a === "火" && b === "金") ||
        		(a === "土" && b === "水"))
        	return "财";
    	else if((a === "金" && b === "土") ||
        		(a === "水" && b === "金") ||
        		(a === "木" && b === "水") ||
        		(a === "火" && b === "木") ||
        		(a === "土" && b === "火"))
        	return "父";    	
    	else if((a === "金" && b === "火") ||
        		(a === "水" && b === "土") ||
        		(a === "木" && b === "金") ||
        		(a === "火" && b === "水") ||
        		(a === "土" && b === "木"))
        		return "官";
    	else 
    	    return "错误";
	},

	yingPosFromShi: function(shiPos){
		var yingPos = shiPos + 3;
		if (yingPos > 6){
			yingPos -= 6;
		}
		return yingPos - 1;
	},

	ganToNumber: function(gan){
		var ganArray = ['甲', '乙', '丙', '丁', "戊", "己", "庚", "辛", "壬", "癸"];
		for (var i=0; i<10; i++){
			if (gan == ganArray[i]){
				return i;
			}
		}
		alert('ganToNumber: gan is error '+gan);
		return 0;
	},

	isClickDisabled: false,

	disableClick: function(){
		this.isClickDisabled = true;
		$('#ok').attr('disabled', true);
		$('#reset').removeAttr('disabled');
		$('.inDate').hide();		

		var iterKey = ['#yaoValue0', '#yaoValue1', '#yaoValue2', '#yaoValue3', '#yaoValue4', '#yaoValue5'];
		for (var i=0; i<6; i++){
			if (!$(iterKey[i]).find('input').attr('checked')){
				$(iterKey[i]).find('.spanDong').hide();
			} 
		}

		$('.inputDong').hide();
		
	},
	enableClick: function(){
		this.isClickDisabled = false;
		$('#ok').removeAttr('disabled');
		$('#reset').attr('disabled', true);
		$('.inDate').show();

		$('.spanDong').show();
		$('.inputDong').show();
	}
};

$('.click-yao').click(function(){
	if (Qigua.isClickDisabled){
		return;
	}

	var yao = $(this).children('strong');
	var yaoValue = yao.html();

	if (yaoValue === YANG){
		yaoValue = YIN;
	} else{
		yaoValue = YANG;
	}

	yao.html(yaoValue)
});

$('#ok').click(function(){
	var year = parseInt($('#inYear').val()) | 0;
	var month = parseInt($('#inMonth').val()) | 0;
	var day = parseInt($('#inDay').val()) | 0;
	var hour = parseInt($('#inHour').val()) | 0;

	if (year < 1900 || year > 2100){
		return;
	}
	if (month < 1 || month > 12){
		return;
	}
	if (day < 1 || day > 31){
		return;
	}
	if (hour < 0 || hour > 23){
		return
	}
	var lunar = calendar.solar2lunar(year, month, day);
	var date = year+'年'+month+'月'+day+'日'+hour+'时';
	date +=' '+lunar.IMonthCn+lunar.IDayCn;	

	var ganzhi = lunar.gzYear+'年 '+lunar.gzMonth+'月 '+lunar.gzDay+'日 ';

	$('#date').html(date);
	$('#ganzhi').html(ganzhi);

	var iterKey = ['#yaoValue0', '#yaoValue1', '#yaoValue2', '#yaoValue3', '#yaoValue4', '#yaoValue5'];
	var chuguaYinYang = [];
	var chuguaValue;

	for (var i = 0; i < 6; i++){
		chuguaYinYang[i] = $(iterKey[i]).find('strong').html();
		if (chuguaYinYang[i] !== YIN && chuguaYinYang[i] !== YANG){
			return;
		}
	}

	chuguaValue = Qigua.yinYangArrayToValue(chuguaYinYang);

	var chuguaBody = QiguaDB[chuguaValue];
	$('#zhuguaName').html(chuguaBody.name + ' (' + chuguaBody.shuxing[0] + '宫)');

	//清空世应
	for (var i = 0; i < 6; i++){
		$(iterKey[i]).find('.shiying').html('');
	}

	for (var i = 0; i < 6; i++){
		//安置六爻
		$(iterKey[i]).find('.liuyao').html(chuguaBody.liuyao[i*2]);
		//安置六亲
		$(iterKey[i]).find('.liuqin').html(Qigua.
			liuqinFromLiuyao(chuguaBody.shuxing[1], chuguaBody.liuyao[i*2+1]));
		//安置世应
		if (i === (chuguaBody.shiying-1)){
			$(iterKey[i]).find('.shiying').html('世');
		}
		if (i === Qigua.yingPosFromShi(chuguaBody.shiying)){
			$(iterKey[i]).find('.shiying').html('应');
		}	
	}
	//安置六神
	var riGanValue = Qigua.ganToNumber(lunar.gzDay[0]);

	if(riGanValue == 5)
		riGanValue =6;
	else if(riGanValue > 5)
		riGanValue = riGanValue + 2;
	riGanValue = Math.floor(riGanValue / 2);
	for (var i=0; i<6; i++){
		$(iterKey[i]).find('.liushen').html(Liushen[(riGanValue+i)%6]);
	}

	var hasBiangua = 0;
	var bianguaYinYang = [];
	var bianguaValue;

	for (var i = 0; i < 6; i++){
		if ($(iterKey[i]).find('input').attr('checked')){
			hasBiangua++;
			bianguaYinYang[i] = Qigua.yinYangSwitch(chuguaYinYang[i]);
		} else{
			bianguaYinYang[i] = chuguaYinYang[i];
		}
	}

	//显示变卦
	if (hasBiangua){		
		bianguaValue = Qigua.yinYangArrayToValue(bianguaYinYang);

		var bianguaBody = QiguaDB[bianguaValue];

		$('#bianguaName').html(bianguaBody.name);

		//生成六爻 六亲
		var liuyaoArr = [];
		var liuqinArr = [];
		for (var i=0; i<6; i++){
			liuyaoArr[i] = bianguaBody.liuyao[i*2];
			liuqinArr[i] = Qigua.liuqinFromLiuyao(chuguaBody.shuxing[1], bianguaBody.liuyao[i*2+1]);
		}

		var tmpl = _.template($('#bianguaTmpl').html());
		var tmplAfterFilling = tmpl({
			yinYangArr: bianguaYinYang,
			liuyaoArr: liuyaoArr,
			liuqinArr: liuqinArr
		});

		$('#bianGua').empty();
		$('#bianGua').append($(tmplAfterFilling));		
	} else{
		$('#bianguaName').html('');
		$('#bianGua').empty();
	}

	//disable click
	Qigua.disableClick();

});

$('#reset').click(function(){
	Qigua.enableClick();
});

$('document').ready(function(){
	var date = new Date();
	$('#inYear').val(date.getFullYear());
	$('#inMonth').val(date.getMonth() + 1);
	$('#inDay').val(date.getDate());
	$('#inHour').val(date.getHours());
	$('#reset').attr('disabled', true);
});
